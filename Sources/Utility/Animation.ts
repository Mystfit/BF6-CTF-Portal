//==============================================================================================
// ANIMATION MANAGER
//==============================================================================================

/**
 * AnimationManager - Asynchronous object animation system
 * 
 * Provides complex animation capabilities beyond the basic MoveObjectOverTime function.
 * Supports path-based animations, speed/duration control, rotation, and callbacks.
 * 
 * Usage:
 *   await animationManager.AnimateAlongPath(object, points, { speed: 10 });
 */

interface ProjectilePoint {
    position: mod.Vector;
    rayId: number;
    hit: boolean;
    hitNormal?: mod.Vector;
    isLast: boolean;
}

interface AnimationOptions {
    speed?: number;              // Units per second (alternative to duration)
    duration?: number;           // Total duration in seconds (overrides speed)
    rotateToDirection?: boolean; // Auto-rotate to face movement direction
    rotationSpeed?: number;      // How fast to rotate in degrees/second (default: instant)
    loop?: boolean;              // Loop the animation
    reverse?: boolean;           // Reverse after completion
    onProgress?: (progress: number, position: mod.Vector) => void;
    onComplete?: () => void;
    onSegmentComplete?: (segmentIndex: number) => void;
}

interface ActiveAnimation {
    object: mod.Object;
    objectId: number;
    cancelled: boolean;
    paused: boolean;
    progress: number;
}

class AnimationManager {
    private activeAnimations: Map<number, ActiveAnimation> = new Map();

    /**
     * Animate an object along a path defined by an array of points
     * @param object The object to animate (SpatialObject, VFX, WorldIcon, etc.)
     * @param points Array of Vector positions defining the path
     * @param options Animation configuration options
     * @returns Promise that resolves when animation completes
     */
    async AnimateAlongPath(
        object: mod.Object,
        points: mod.Vector[],
        options: AnimationOptions = {}
    ): Promise<void> {
        if (points.length < 2) {
            console.error("AnimateAlongPath requires at least 2 points");
            return;
        }

        const objectId = mod.GetObjId(object);
        
        // Register active animation with expected position tracking
        const animation: ActiveAnimation = {
            object,
            objectId,
            cancelled: false,
            paused: false,
            progress: 0
        };
        this.activeAnimations.set(objectId, animation);

        // Track expected position to avoid precision loss from GetObjectPosition
        let expectedPosition = points[0];

        try {
            // Calculate total path distance
            let totalDistance = 0;
            for (let i = 0; i < points.length - 1; i++) {
                totalDistance += VectorLength(Math2.Vec3.FromVector(points[i + 1]).Subtract(Math2.Vec3.FromVector(points[i])).ToVector()); //mod.Subtract(points[i + 1], points[i]));
            }

            // Determine timing
            let totalDuration: number;
            if (options.duration !== undefined) {
                totalDuration = options.duration;
            } else if (options.speed !== undefined) {
                totalDuration = totalDistance / options.speed;
            } else {
                // Default: 1 second per unit of distance
                totalDuration = totalDistance;
            }

            // Animate through each segment
            let elapsedTime = 0;
            for (let i = 0; i < points.length - 1; i++) {
                if (animation.cancelled) break;

                const startPoint = expectedPosition; // Use tracked position
                const endPoint = points[i + 1];
                const segmentDistance = VectorLength(Math2.Vec3.FromVector(endPoint).Subtract(Math2.Vec3.FromVector(startPoint)).ToVector()); //mod.Subtract(endPoint, startPoint));
                const segmentDuration = (segmentDistance / totalDistance) * totalDuration;

                // Calculate rotation if needed
                let rotation = ZERO_VEC;
                if (options.rotateToDirection) {
                    rotation = this.CalculateRotationFromDirection(
                        Math2.Vec3.FromVector(endPoint).Subtract(Math2.Vec3.FromVector(startPoint)).ToVector() //mod.Subtract(endPoint, startPoint)
                    );
                }

                // Animate this segment
                await this.AnimateBetweenPoints(
                    object,
                    startPoint,
                    endPoint,
                    segmentDuration,
                    {
                        ...options,
                        rotation,
                        isSegment: true
                    }
                );

                // Update expected position for next segment
                expectedPosition = endPoint;

                elapsedTime += segmentDuration;
                animation.progress = elapsedTime / totalDuration;

                if (options.onProgress) {
                    options.onProgress(animation.progress, expectedPosition);
                }

                if (options.onSegmentComplete) {
                    options.onSegmentComplete(i);
                }
            }

            // Handle loop/reverse
            if (!animation.cancelled) {
                if (options.reverse) {
                    const reversedPoints = [...points].reverse();
                    await this.AnimateAlongPath(object, reversedPoints, {
                        ...options,
                        reverse: false // Prevent infinite recursion
                    });
                } else if (options.loop) {
                    await this.AnimateAlongPath(object, points, options);
                }
            }

            if (options.onComplete && !animation.cancelled) {
                options.onComplete();
            }
        } finally {
            this.activeAnimations.delete(objectId);
        }
    }

    /**
     * Animate an object between two points
     * @param object The object to animate
     * @param startPos Starting position (expected position from tracking)
     * @param endPos Ending position
     * @param duration Time in seconds
     * @param options Additional options including rotation
     */
    private async AnimateBetweenPoints(
        object: mod.Object,
        startPos: mod.Vector,
        endPos: mod.Vector,
        duration: number,
        options: any = {}
    ): Promise<void> {
        const objectId = mod.GetObjId(object);
        const animation = this.activeAnimations.get(objectId);
        
        if (!animation || animation.cancelled) return;

        // Calculate delta from expected start position to end position
        // We use startPos (which is our tracked expected position) instead of GetObjectPosition
        // to avoid precision loss from the engine's position rounding
        const positionDelta = Math2.Vec3.FromVector(endPos).Subtract(Math2.Vec3.FromVector(startPos)).ToVector(); //mod.Subtract(endPos, startPos);
        const rotationDelta = options.rotation || ZERO_VEC;

        if (DEBUG_MODE) {
            // Detailed precision logging
            console.log(`=== Animation Segment Debug ===`);
            console.log(`Start pos (tracked): X:${mod.XComponentOf(startPos).toFixed(6)}, Y:${mod.YComponentOf(startPos).toFixed(6)}, Z:${mod.ZComponentOf(startPos).toFixed(6)}`);
            console.log(`End pos (target): X:${mod.XComponentOf(endPos).toFixed(6)}, Y:${mod.YComponentOf(endPos).toFixed(6)}, Z:${mod.ZComponentOf(endPos).toFixed(6)}`);
            console.log(`Position delta: X:${mod.XComponentOf(positionDelta).toFixed(6)}, Y:${mod.YComponentOf(positionDelta).toFixed(6)}, Z:${mod.ZComponentOf(positionDelta).toFixed(6)}`);
            console.log(`Rotation delta: X:${mod.XComponentOf(rotationDelta).toFixed(6)}, Y:${mod.YComponentOf(rotationDelta).toFixed(6)}, Z:${mod.ZComponentOf(rotationDelta).toFixed(6)}`);
        }

        // Use MoveObjectOverTime for smooth animation
        // mod.MoveObjectOverTime(
        //     object,
        //     positionDelta,
        //     rotationDelta,
        //     duration,
        //     false, // Don't loop
        //     false  // Don't reverse
        // );
        mod.SetObjectTransform(object, mod.CreateTransform(endPos, options.rotation));

        // Wait for the animation to complete
        await mod.Wait(duration);
    }

    /**
     * Simple animation to a target position
     * @param object The object to animate
     * @param targetPos Target position
     * @param duration Duration in seconds
     * @param options Animation options
     */
    async AnimateToPosition(
        object: mod.Object,
        targetPos: mod.Vector,
        duration: number,
        options: AnimationOptions = {}
    ): Promise<void> {
        const currentPos = mod.GetObjectPosition(object);
        await this.AnimateAlongPath(object, [currentPos, targetPos], {
            ...options,
            duration
        });
    }

    /**
     * Calculate Euler rotation to face a direction vector
     * @param direction Direction vector to face
     * @returns Rotation vector (Euler angles in radians)
     */
    private CalculateRotationFromDirection(direction: mod.Vector): mod.Vector {
        const normalized = mod.Normalize(direction);
        const x = mod.XComponentOf(normalized);
        const y = mod.YComponentOf(normalized);
        const z = mod.ZComponentOf(normalized);

        // Calculate yaw (rotation around Y axis)
        const yaw = Math.atan2(x, -z);

        // Calculate pitch (rotation around X axis)
        const horizontalDist = Math.sqrt(x * x + z * z);
        const pitch = Math.atan2(y, horizontalDist);

        // Return as Euler angles (pitch, yaw, roll)
        return mod.CreateVector(pitch, yaw, 0);
    }

    /**
     * Animate an object along a path that is generated concurrently by an AsyncGenerator
     * This allows animation to start before the full path is calculated, reducing perceived latency
     * 
     * @param object The object to animate
     * @param generator AsyncGenerator that yields ProjectilePoint objects
     * @param minBufferSize Minimum number of points to stay ahead of animation (safety buffer)
     * @param options Animation options
     * @returns Promise that resolves when animation completes
     */
    async AnimateAlongGeneratedPath(
        object: mod.Object,
        generator: AsyncGenerator<ProjectilePoint>,
        minBufferSize: number,
        options: AnimationOptions = {}
    ): Promise<void> {
        const objectId = mod.GetObjId(object);
        
        // Register active animation
        const animation: ActiveAnimation = {
            object,
            objectId,
            cancelled: false,
            paused: false,
            progress: 0
        };
        this.activeAnimations.set(objectId, animation);

        const pointBuffer: ProjectilePoint[] = [];
        let generatorComplete = false;
        let currentPosition: mod.Vector;
        let animationStarted = false;
        let bufferStarvationCount = 0;

        try {
            if(DEBUG_MODE) console.log(`[AnimateAlongGeneratedPath] Starting concurrent animation with buffer size ${minBufferSize}`);

            // Phase 1: Fill initial buffer (minBufferSize + 2 points)
            const initialBufferSize = minBufferSize + 2;
            for (let i = 0; i < initialBufferSize; i++) {
                const result = await generator.next();
                if (result.done) {
                    generatorComplete = true;
                    break;
                }
                pointBuffer.push(result.value);
                
                if(DEBUG_MODE) {
                    console.log(`[AnimateAlongGeneratedPath] Buffered point ${i + 1}/${initialBufferSize}: ${VectorToString(result.value.position)}`);
                }
            }

            if (pointBuffer.length < 2) {
                console.error("AnimateAlongGeneratedPath: Not enough points generated for animation");
                return;
            }

            // Set starting position
            currentPosition = pointBuffer[0].position;
            
            if(DEBUG_MODE) {
                console.log(`[AnimateAlongGeneratedPath] Initial buffer filled with ${pointBuffer.length} points, starting animation`);
            }

            // Phase 2: Concurrent animation and generation
            animationStarted = true;
            let segmentIndex = 0;
            
            while (pointBuffer.length > 1 || !generatorComplete) {
                if (animation.cancelled) break;

                // Check if we need to wait for more points
                if (pointBuffer.length <= minBufferSize && !generatorComplete) {
                    if(DEBUG_MODE) {
                        console.log(`[AnimateAlongGeneratedPath] Buffer low (${pointBuffer.length} points), waiting for generator...`);
                    }
                    bufferStarvationCount++;
                    
                    // Try to fill buffer back up
                    const result = await generator.next();
                    if (result.done) {
                        generatorComplete = true;
                        if(DEBUG_MODE) console.log(`[AnimateAlongGeneratedPath] Generator completed`);
                    } else {
                        pointBuffer.push(result.value);
                        if(DEBUG_MODE) {
                            console.log(`[AnimateAlongGeneratedPath] Added point to buffer: ${VectorToString(result.value.position)}`);
                        }
                    }
                    continue;
                }

                // If generator is still running and buffer has room, try to add more points
                if (!generatorComplete && pointBuffer.length < initialBufferSize * 2) {
                    const result = await generator.next();
                    if (result.done) {
                        generatorComplete = true;
                        if(DEBUG_MODE) console.log(`[AnimateAlongGeneratedPath] Generator completed`);
                    } else {
                        pointBuffer.push(result.value);
                    }
                }

                // Check if we should stop consuming points (hit detected or at end)
                const shouldStopConsuming = generatorComplete && pointBuffer.length <= minBufferSize + 2;
                
                if (shouldStopConsuming) {
                    if(DEBUG_MODE) {
                        console.log(`[AnimateAlongGeneratedPath] Stopping animation consumption, ${pointBuffer.length} points remaining in buffer`);
                    }
                    break;
                }

                // Animate to next point
                if (pointBuffer.length > 1) {
                    const startPoint = pointBuffer.shift()!; // Remove first point
                    const endPoint = pointBuffer[0]; // Peek at next point (don't remove yet)
                    
                    const segmentDistance = VectorLength(
                        Math2.Vec3.FromVector(endPoint.position)
                            .Subtract(Math2.Vec3.FromVector(startPoint.position))
                            .ToVector()
                    );
                    
                    const segmentDuration = options.speed ? segmentDistance / options.speed : 0.1;

                    if(DEBUG_MODE) {
                        console.log(`[AnimateAlongGeneratedPath] Animating segment ${segmentIndex}: ${VectorToString(startPoint.position)} -> ${VectorToString(endPoint.position)} (${segmentDistance.toFixed(2)} units, ${segmentDuration.toFixed(3)}s, buffer: ${pointBuffer.length})`);
                    }

                    // Calculate rotation if needed
                    let rotation = ZERO_VEC;
                    if (options.rotateToDirection) {
                        rotation = this.CalculateRotationFromDirection(
                            Math2.Vec3.FromVector(endPoint.position)
                                .Subtract(Math2.Vec3.FromVector(startPoint.position))
                                .ToVector()
                        );
                    }

                    // Animate this segment
                    await this.AnimateBetweenPoints(
                        object,
                        currentPosition,
                        endPoint.position,
                        segmentDuration,
                        { rotation }
                    );

                    currentPosition = endPoint.position;
                    segmentIndex++;

                    // Call progress callback
                    if (options.onProgress) {
                        options.onProgress(segmentIndex / (segmentIndex + pointBuffer.length), currentPosition);
                    }

                    if (options.onSegmentComplete) {
                        options.onSegmentComplete(segmentIndex);
                    }
                }
            }

            // Phase 3: Animate through remaining buffered points
            if (pointBuffer.length > 0) {
                if(DEBUG_MODE) {
                    console.log(`[AnimateAlongGeneratedPath] Animating through ${pointBuffer.length} remaining buffered points`);
                }
                
                // Animate through all remaining points in buffer
                while (pointBuffer.length > 0) {
                    const startPoint = pointBuffer.shift()!;
                    
                    // If there's a next point, animate to it; otherwise we're at the last point
                    if (pointBuffer.length > 0) {
                        const endPoint = pointBuffer[0];
                        
                        const segmentDistance = VectorLength(
                            Math2.Vec3.FromVector(endPoint.position)
                                .Subtract(Math2.Vec3.FromVector(startPoint.position))
                                .ToVector()
                        );
                        
                        const segmentDuration = options.speed ? segmentDistance / options.speed : 0.1;
                        
                        let rotation = ZERO_VEC;
                        if (options.rotateToDirection) {
                            rotation = this.CalculateRotationFromDirection(
                                Math2.Vec3.FromVector(endPoint.position)
                                    .Subtract(Math2.Vec3.FromVector(startPoint.position))
                                    .ToVector()
                            );
                        }
                        
                        await this.AnimateBetweenPoints(
                            object,
                            currentPosition,
                            endPoint.position,
                            segmentDuration,
                            { rotation }
                        );
                        
                        currentPosition = endPoint.position;
                        segmentIndex++;
                        
                        if (options.onProgress) {
                            options.onProgress(1.0, currentPosition);
                        }
                    } else {
                        // This was the last point - just set position directly if not already there
                        if(DEBUG_MODE) {
                            console.log(`[AnimateAlongGeneratedPath] Reached final point: ${VectorToString(startPoint.position)}`);
                        }
                        const finalDistance = VectorLength(
                            Math2.Vec3.FromVector(startPoint.position)
                                .Subtract(Math2.Vec3.FromVector(currentPosition))
                                .ToVector()
                        );
                        
                        if (finalDistance > 0.1) {
                            const finalDuration = options.speed ? finalDistance / options.speed : 0.1;
                            
                            let finalRotation = ZERO_VEC;
                            if (options.rotateToDirection) {
                                finalRotation = this.CalculateRotationFromDirection(
                                    Math2.Vec3.FromVector(startPoint.position)
                                        .Subtract(Math2.Vec3.FromVector(currentPosition))
                                        .ToVector()
                                );
                            }
                            
                            await this.AnimateBetweenPoints(
                                object,
                                currentPosition,
                                startPoint.position,
                                finalDuration,
                                { rotation: finalRotation }
                            );
                            
                            currentPosition = startPoint.position;
                        }
                    }
                }
            }

            if(DEBUG_MODE) {
                console.log(`[AnimateAlongGeneratedPath] Animation complete. Segments: ${segmentIndex}, Buffer starvation events: ${bufferStarvationCount}`);
                if (bufferStarvationCount > 0) {
                    console.log(`[AnimateAlongGeneratedPath] WARNING: Buffer was starved ${bufferStarvationCount} times. Consider increasing minBufferSize or reducing animation speed.`);
                }
            }

            if (options.onComplete && !animation.cancelled) {
                options.onComplete();
            }
        } catch (error) {
            console.error(`[AnimateAlongGeneratedPath] Error during animation:`, error);
            throw error;
        } finally {
            this.activeAnimations.delete(objectId);
        }
    }

    /**
     * Stop an active animation
     * @param object The object whose animation should be stopped
     */
    StopAnimation(object: mod.Object): void {
        const objectId = mod.GetObjId(object);
        const animation = this.activeAnimations.get(objectId);
        
        if (animation) {
            animation.cancelled = true;
            mod.StopActiveMovementForObject(object);
            this.activeAnimations.delete(objectId);
        }
    }

    /**
     * Check if an object is currently animating
     * @param object The object to check
     * @returns True if the object is animating
     */
    IsAnimating(object: mod.Object): boolean {
        const objectId = mod.GetObjId(object);
        return this.activeAnimations.has(objectId);
    }

    /**
     * Get the current animation progress (0-1)
     * @param object The object to check
     * @returns Progress value between 0 and 1, or 0 if not animating
     */
    GetAnimationProgress(object: mod.Object): number {
        const objectId = mod.GetObjId(object);
        const animation = this.activeAnimations.get(objectId);
        return animation ? animation.progress : 0;
    }

    /**
     * Pause an active animation
     * @param object The object whose animation should be paused
     */
    PauseAnimation(object: mod.Object): void {
        const objectId = mod.GetObjId(object);
        const animation = this.activeAnimations.get(objectId);
        
        if (animation) {
            animation.paused = true;
            mod.StopActiveMovementForObject(object);
        }
    }

    /**
     * Resume a paused animation
     * @param object The object whose animation should be resumed
     */
    ResumeAnimation(object: mod.Object): void {
        const objectId = mod.GetObjId(object);
        const animation = this.activeAnimations.get(objectId);
        
        if (animation) {
            animation.paused = false;
            // Note: Resuming requires storing the remaining path/duration
            // This is a simplified implementation
        }
    }

    /**
     * Stop all active animations
     */
    StopAllAnimations(): void {
        for (const [objectId, animation] of this.activeAnimations.entries()) {
            animation.cancelled = true;
            mod.StopActiveMovementForObject(animation.object);
        }
        this.activeAnimations.clear();
    }
}

// Global animation manager instance
const animationManager = new AnimationManager();
