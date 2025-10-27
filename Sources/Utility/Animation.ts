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