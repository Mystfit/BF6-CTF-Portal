//==============================================================================================
// RAYCAST MANAGER
//==============================================================================================

/**
 * RaycastManager - Asynchronous raycast queue system
 * 
 * Wraps mod.RayCast, OnRayCastHit, and OnRayCastMissed to enable Promise-based raycasts.
 * Uses a FIFO queue to match raycast requests with their results, allowing multiple
 * raycasts to be in-flight simultaneously.
 * 
 * Usage:
 *   const result = await raycastManager.cast(startPos, endPos);
 *   if (result.hit) {
 *     console.log("Hit at:", result.point);
 *   }
 */

interface RaycastResult {
    hit: boolean;           // true if OnRayCastHit fired, false if OnRayCastMissed
    ID: number             // Unique ID for this raycast result
    player?: mod.Player;    // The player who cast the ray (may be undefined for non-player raycasts)
    point: mod.Vector;      // Hit point or end of ray if no hit was found
    normal?: mod.Vector;    // Surface normal (only when hit=true)
}

interface RaycastRequest {
    player?: mod.Player;    // Player who initiated the raycast (may be undefined)
    id: number,
    resolve: (result: RaycastResult) => void;  // Promise resolve function
    reject: (error: any) => void;              // Promise reject function
    debug?: boolean;        // Whether to visualize this raycast
    debugDuration?: number; // Duration for debug visualization
    start: mod.Vector;     // Start position (for visualization)
    stop: mod.Vector;      // End position (for visualization)
}

interface ProjectileRaycastResult {
    hit: boolean;
    arcPoints: mod.Vector[];
    rayIds: number[],
    hitPosition?: mod.Vector;
    hitNormal?: mod.Vector;
}

interface ValidatedSpawnResult {
    position: mod.Vector;
    isValid: boolean;
}

interface ProjectilePoint {
    position: mod.Vector;
    rayId: number;
    hit: boolean;
    hitNormal?: mod.Vector;
    isLast: boolean;
}

class RaycastManager {
    private queue: RaycastRequest[] = [];
    private static ids: number = 0;

    static Get(): RaycastManager{
        return raycastManager;
    }

    static GetID(): number {
        return RaycastManager.ids;
    }
    
    static GetNextID(): number{
        return ++RaycastManager.ids;
    }

    /**
     * Cast a ray from start to stop without player context
     * @param start Start position
     * @param stop End position
     * @param debug Enable visualization of raycasts (default: false)
     * @param debugDuration Duration in seconds for debug visualization (default: 5)
     * @returns Promise that resolves with raycast result
     */
    static cast(start: mod.Vector, stop: mod.Vector, debug: boolean = false, debugDuration: number = 5): Promise<RaycastResult> {
        return new Promise<RaycastResult>(async (resolve, reject) => {
            try {
                // Validate parameters
                if (!start || !stop) {
                    reject(new Error('RaycastManager.cast() requires valid start and stop vectors'));
                    return;
                }
                
                // Add request to queue with debug info
                let id = RaycastManager.GetNextID();
                RaycastManager.Get().queue.push({ 
                    player: undefined, 
                    id, 
                    resolve, 
                    reject,
                    debug,
                    debugDuration,
                    start,
                    stop
                });
                
                if(DEBUG_MODE) {
                    const rayLength = VectorLength(Math2.Vec3.FromVector(stop).Subtract(Math2.Vec3.FromVector(start)).ToVector());
                    console.log(`[Raycast ${id}] Casting ray - Start: ${VectorToString(start)}, End: ${VectorToString(stop)}, Length: ${rayLength.toFixed(2)}`);
                }
                
                // Call the actual raycast function
                mod.RayCast(start, stop);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Cast a ray from start to stop with a player context
     * @param player The player casting the ray
     * @param start Start position
     * @param stop End position
     * @param debug Enable visualization of raycasts (default: false)
     * @param debugDuration Duration in seconds for debug visualization (default: 5)
     * @returns Promise that resolves with raycast result
     */
    static castWithPlayer(player: mod.Player, start: mod.Vector, stop: mod.Vector, debug: boolean = false, debugDuration: number = 5): Promise<RaycastResult> {
        return new Promise<RaycastResult>(async (resolve, reject) => {
            try {
                // Validate parameters
                if (!start || !stop) {
                    reject(new Error('RaycastManager.castWithPlayer() requires valid start and stop vectors'));
                    return;
                }
                
                if (!player || !mod.IsPlayerValid(player)) {
                    reject(new Error('RaycastManager.castWithPlayer() requires a valid player'));
                    return;
                }
                
                // Add request to queue with debug info
                let id = RaycastManager.GetNextID();
                RaycastManager.Get().queue.push({ 
                    player, 
                    id, 
                    resolve, 
                    reject,
                    debug,
                    debugDuration,
                    start,
                    stop
                });
                
                if(DEBUG_MODE) {
                    const rayLength = VectorLength(Math2.Vec3.FromVector(stop).Subtract(Math2.Vec3.FromVector(start)).ToVector());
                    console.log(`[Raycast ${id}] Casting ray with player - Start: ${VectorToString(start)}, End: ${VectorToString(stop)}, Length: ${rayLength.toFixed(2)}`);
                }
                
                // Call the actual raycast function
                mod.RayCast(player, start, stop);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle a raycast hit event from OnRayCastHit
     * @param player The player from the event
     * @param point The hit point
     * @param normal The surface normal
     */
    async handleHit(player: mod.Player, point: mod.Vector, normal: mod.Vector): Promise<void> {
        if(DEBUG_MODE) console.log("Start of handleHit");

        if (this.queue.length === 0) {
            if (DEBUG_MODE) {
                console.log('Warning: Received OnRayCastHit but queue is empty');
            }
            return;
        }

        if(DEBUG_MODE) console.log("Popping raycast request");
        // Pop the first request from the queue (FIFO)
        const request = this.queue.shift()!;
        
        if(DEBUG_MODE) {
            const distanceTraveled = request.start && request.stop 
                ? VectorLength(Math2.Vec3.FromVector(point).Subtract(Math2.Vec3.FromVector(request.start)).ToVector())
                : 0;
            console.log(`[Raycast ${request.id}] HIT - Start: ${request.start ? VectorToString(request.start) : "unknown"}, Hit: ${VectorToString(point)}, Distance: ${distanceTraveled.toFixed(2)}`);
        }
        
        if(DEBUG_MODE) console.log("Before raycast viz");
        // Visualize if debug was enabled for this raycast
        if (request.debug && request.start && request.stop) {
            this.VisualizeRaycast(request.start, point, request.debugDuration || 5, true);
        }
        if(DEBUG_MODE) console.log("After raycast viz");
        
        // Defer promise resolution to break out of event handler call stack
        // This prevents deadlocks when subsequent raycasts are called immediately after awaiting
        await mod.Wait(0);
        
        // Resolve the promise with hit result
        request.resolve({
            hit: true,
            player: player,
            point: point,
            normal: normal,
            ID: request.id
        });
        if(DEBUG_MODE) console.log("After raycast resolve");
    }

    /**
     * Handle a raycast miss event from OnRayCastMissed
     * @param player The player from the event
     */
    async handleMiss(player: mod.Player): Promise<void> {
        if (this.queue.length === 0) {
            if (DEBUG_MODE) {
                console.log('Warning: Received OnRayCastMissed but queue is empty');
            }
            return;
        }

        // Pop the first request from the queue (FIFO)
        const request = this.queue.shift()!;
        
        if(DEBUG_MODE) {
            const rayLength = request.start && request.stop
                ? VectorLength(Math2.Vec3.FromVector(request.stop).Subtract(Math2.Vec3.FromVector(request.start)).ToVector())
                : 0;
            console.log(`[Raycast ${request.id}] MISS - Start: ${request.start ? VectorToString(request.start) : "unknown"}, End: ${request.stop ? VectorToString(request.stop) : "unknown"}, Length: ${rayLength.toFixed(2)}`);
        }
        
        // Visualize if debug was enabled for this raycast
        if (request.debug && request.start && request.stop) {
            this.VisualizeRaycast(request.start, request.stop, request.debugDuration || 5, false);
        }
        
        // Defer promise resolution to break out of event handler call stack
        // This prevents deadlocks when subsequent raycasts are called immediately after awaiting
        await mod.Wait(0);
        
        // Resolve the promise with miss result
        request.resolve({
            hit: false,
            player: player,
            point: request.stop,
            ID: request.id
        });
    }

    /**
     * Get the current queue length (useful for debugging)
     */
    getQueueLength(): number {
        return this.queue.length;
    }

    /**
     * Visualize a raycast result
     * @param start Start position of the ray
     * @param end End position (hit point if hit=true, intended end if hit=false)
     * @param debugDuration Duration in seconds for visualization
     * @param hit Whether the ray hit something
     */
    private async VisualizeRaycast(
        start: mod.Vector,
        end: mod.Vector,
        debugDuration: number,
        hit: boolean
    ): Promise<void> {
        // Interpolate points along the ray line (minimum 1 per unit)
        const rayVector = Math2.Vec3.FromVector(end).Subtract(Math2.Vec3.FromVector(start)).ToVector();
        const rayLength = VectorLength(rayVector);
        const numPoints = Math.max(2, Math.ceil(rayLength));
        const points: mod.Vector[] = [];
        
        // Create interpolated points
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const point = mod.Add(start, mod.Multiply(rayVector, t));
            points.push(point);
        }
        
        // Choose colors based on hit/miss
        // Hit: green ray, red endpoint
        // Miss: yellow ray, magenta endpoint
        const rayColor = hit 
            ? new rgba(0, 255, 0, 1).NormalizeToLinear().AsModVector3()
            : new rgba(255, 255, 0, 1).NormalizeToLinear().AsModVector3();
        const endColor = hit
            ? new rgba(255, 0, 0, 1).NormalizeToLinear().AsModVector3()
            : new rgba(255, 0, 255, 1).NormalizeToLinear().AsModVector3();
        
        // Visualize the ray line
        this.VisualizePoints(points, rayColor, debugDuration);
        
        // Visualize end point with different color
        this.VisualizePoints([end], endColor, debugDuration, [], hit ? mod.WorldIconImages.Cross : mod.WorldIconImages.Triangle);
    }

    /**
     * Visualize an array of points using WorldIcons
     * 
     * @param points Array of positions to visualize
     * @param color Optional color for the icons (default: yellow)
     * @param debugDuration Duration in seconds before icons are destroyed (default: 5, 0 or negative = persist indefinitely)
     * @param rayIds Array of text to draw per point
     * @param iconImage Custom icon to use
     * @returns Promise that resolves after visualization is complete
     */
    async VisualizePoints(
        points: mod.Vector[], 
        color?: mod.Vector,
        debugDuration: number = 5,
        rayIds?: number[],
        iconImage?: mod.WorldIconImages
    ): Promise<void> {
        // Default to yellow if no color provided
        const iconColor = color ?? new rgba(255, 255, 0, 1).NormalizeToLinear().AsModVector3();
        const lastIconColor = color ?? new rgba(255, 0, 0, 1).NormalizeToLinear().AsModVector3();
        const icon = iconImage ?? mod.WorldIconImages.Triangle;

        // Create WorldIcons for each point
        const icons: mod.WorldIcon[] = [];
        for (const [idx, point] of points.entries()) {
            const worldIcon: mod.WorldIcon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, point, ZERO_VEC);
            mod.SetWorldIconImage(worldIcon,icon);
            mod.SetWorldIconColor(worldIcon, (idx < points.length - 1) ? iconColor : lastIconColor);
            mod.EnableWorldIconImage(worldIcon, true);
            if(rayIds){
                if(idx < rayIds.length){
                    mod.EnableWorldIconText(worldIcon, true);
                    mod.SetWorldIconText(worldIcon, mod.Message(rayIds[idx]));
                }
            }
            icons.push(worldIcon);
        }
        
        // If debugDuration is positive, wait and then destroy icons
        if (debugDuration > 0) {
            await mod.Wait(debugDuration);
            for (const icon of icons) {
                mod.UnspawnObject(icon);
            }
        }
        // If debugDuration <= 0, icons persist indefinitely (no cleanup)
    }

    /**
     * Find a valid position on the ground by casting rays forward and down
     * 
     * This utility method finds a safe position on the ground by:
     * 1. Casting a ray forward from the starting position
     * 2. Using radial collision checks to find a safe position away from obstacles
     * 3. Casting a ray downward to find the ground
     * 
     * @param startPosition The starting position for the raycast
     * @param direction The direction to cast (normalized)
     * @param forwardDistance How far to cast forward
     * @param collisionRadius Safety radius to avoid spawning inside objects
     * @param downwardDistance Maximum distance to cast downward
     * @param debug Enable visualization of raycasts (default: false)
     * @param debugDuration Duration in seconds for debug visualization (default: 5)
     * @returns Promise resolving to the ground position, or the start position if no ground found
     */
    static async FindValidGroundPosition(
        startPosition: mod.Vector,
        direction: mod.Vector,
        forwardDistance: number,
        collisionRadius: number,
        downwardDistance: number,
        debug: boolean = false,
        debugDuration: number = 5
    ): Promise<RaycastResult> {
        let highPosition = startPosition;
        
        // Cast forward to check for obstacles
        let forwardHit: RaycastResult = {hit: false, ID:-1, point: ZERO_VEC};
        
        if (direction) {
            // Don't let ray start inside the starting object
            let forwardRayStart = mod.Add(startPosition, mod.Multiply(direction, 1));
            let forwardRayEnd = mod.Add(forwardRayStart, mod.Multiply(direction, forwardDistance));
            forwardHit = await RaycastManager.cast(forwardRayStart, forwardRayEnd);
            highPosition = forwardHit.point ?? forwardRayEnd;
            
            // Visualize forward ray (blue)
            if (debug) {
                const blueColor = new rgba(0, 0, 255, 1).NormalizeToLinear().AsModVector3();
                await raycastManager.VisualizePoints([forwardRayStart, highPosition], blueColor, debugDuration);
            }
            
            if (DEBUG_MODE) {
                console.log(`Forward raycast - Hit: ${forwardHit.hit}, Location: ${forwardHit.point ? VectorToString(forwardHit.point) : "none"}`);
            }
        }

        // Begin normal downward ray ground check
        //---------------------------------------
        // If we hit something, back up by collision radius
        let downwardRayStart = forwardHit.hit 
            ? mod.Add(highPosition, mod.Multiply(direction, collisionRadius * -1)) 
            : highPosition;
        
        // Cast downward to find ground
        let downwardRayEnd = mod.Add(downwardRayStart, mod.Multiply(mod.DownVector(), downwardDistance));
        let downHit = await RaycastManager.cast(downwardRayStart, downwardRayEnd);
        
        // Visualize downward ray (green) and final position (red)
        if (debug) {
            const finalPosition = downHit.hit ? (downHit.point ?? startPosition) : startPosition;
            const greenColor = new rgba(0, 255, 0, 1).NormalizeToLinear().AsModVector3();
            const redColor = new rgba(255, 0, 0, 1).NormalizeToLinear().AsModVector3();
            await raycastManager.VisualizePoints([downwardRayStart, finalPosition], greenColor, debugDuration);
            await raycastManager.VisualizePoints([finalPosition], redColor, debugDuration);
        }
        
        if (DEBUG_MODE) {
            console.log(`Downward raycast - Hit: ${downHit.hit}, Location: ${downHit.point ? VectorToString(downHit.point) : "none"}`);
        }
        
        return downHit;
        
        // End normal downward ray ground check
        //-------------------------------------
        
        // // Use radial validation to find a safe spawn position
        // const validatedResult = await RaycastManager.ValidateSpawnLocationWithRadialCheck(
        //     highPosition,
        //     collisionRadius,
        //     SPAWN_VALIDATION_DIRECTIONS,
        //     downwardDistance
        // );
        
        // if (!validatedResult.isValid && DEBUG_MODE) {
        //     console.log(`Warning: FindValidGroundPosition could not find valid location`);
        // }
        
        // return validatedResult.position;
    }

    static async ProjectileRaycast(
        startPosition: mod.Vector,
        velocity: mod.Vector,
        distance: number,
        sampleRate: number,
        player?: mod.Player | null,
        gravity: number = 9.8,
        debug: boolean = false,
        debugDuration: number = 5
    ): Promise<ProjectileRaycastResult> {
        const arcPoints: mod.Vector[] = [];
        const rayIds: number[] = [];
        const timeStep = 1.0 / sampleRate;
        
        let currentPos = startPosition;
        let currentVelocity = velocity;
        let totalDistance = 0;
        let hit = false;
        let hitPosition: mod.Vector | undefined;
        let hitNormal: mod.Vector | undefined;
        
        arcPoints.push(currentPos);

        if(DEBUG_MODE) console.log(`[ProjectileRaycast] Starting - Position: ${VectorToString(startPosition)}, Velocity: ${VectorToString(velocity)}, MaxDistance: ${distance}, SampleRate: ${sampleRate}, Gravity: ${gravity}`);
        
        let iteration = 0;
        while (totalDistance < distance && !hit) {
            iteration++;
            const gravityVec = mod.Multiply(mod.DownVector(), gravity * timeStep);
            currentVelocity = mod.Add(currentVelocity, gravityVec);
            
            const displacement = mod.Multiply(currentVelocity, timeStep);
            const nextPos = mod.Add(currentPos, displacement);
            
            if(DEBUG_MODE) {
                console.log(`[ProjectileRaycast] Iteration ${iteration} - From: ${VectorToString(currentPos)} To: ${VectorToString(nextPos)}, TotalDist: ${totalDistance.toFixed(2)}`);
            }

            const rayResult = player ? await this.castWithPlayer(player, currentPos, nextPos) :  await RaycastManager.cast(currentPos, nextPos);
            if(DEBUG_MODE) {
                console.log(`[ProjectileRaycast] Iteration ${iteration} - Result: ${rayResult.hit ? "HIT" : "MISS"} at ${VectorToString(rayResult.point ?? nextPos)}`);
            }
            if (rayResult.hit && rayResult.point) {
                hit = true;
                hitPosition = rayResult.point;
                hitNormal = rayResult.normal;
                arcPoints.push(rayResult.point);
                rayIds.push(rayResult.ID);
                break;
            }
            
            currentPos = nextPos;
            arcPoints.push(currentPos);
            rayIds.push(rayResult.ID);
            
            totalDistance += VectorLength(displacement);
        }
        
        if(DEBUG_MODE) {
            console.log(`[ProjectileRaycast] Complete - Total iterations: ${iteration}, Final hit: ${hit}, Total distance: ${totalDistance.toFixed(2)}, Hit position: ${hitPosition ? VectorToString(hitPosition) : "none"}`);
        }
        
        // Visualize arc path if debug is enabled (yellow by default)
        if (debug && arcPoints.length > 0) {
            if(DEBUG_MODE) console.log(`Before projectile viz`);
            RaycastManager.Get().VisualizePoints(arcPoints, undefined, debugDuration, rayIds);
            if(DEBUG_MODE) console.log(`After projectile viz`);
        }
        
        return {
            hit,
            arcPoints,
            rayIds,
            hitPosition,
            hitNormal
        };
    }

    /**
     * Generator version of ProjectileRaycast that yields points as they are calculated
     * This allows concurrent animation while raycasts are still being performed
     * 
     * @param startPosition Starting position for the projectile
     * @param velocity Initial velocity vector
     * @param distance Maximum distance to travel
     * @param sampleRate Number of samples per second
     * @param player Optional player context for raycasts
     * @param gravity Gravity acceleration (default: 9.8)
     * @param debug Enable visualization
     * @param interpolationSteps Number of interpolated points to yield between each raycast (default: 3, 0 = no interpolation)
     * @param onHitDetected Optional callback when hit is detected, returns validated final position
     * @returns AsyncGenerator that yields ProjectilePoint objects as they are calculated
     */
    static async *ProjectileRaycastGenerator(
        startPosition: mod.Vector,
        velocity: mod.Vector,
        distance: number,
        sampleRate: number,
        player?: mod.Player | null,
        gravity: number = 9.8,
        debug: boolean = false,
        interpolationSteps: number = 5,
        onHitDetected?: (hitPoint: mod.Vector, hitNormal?: mod.Vector) => Promise<mod.Vector>
    ): AsyncGenerator<ProjectilePoint> {
        const timeStep = 1.0 / sampleRate;
        
        let currentPos = startPosition;
        let currentVelocity = velocity;
        let totalDistance = 0;
        let hit = false;
        
        // Yield the starting point
        yield {
            position: currentPos,
            rayId: -1,
            hit: false,
            isLast: false
        };

        if(DEBUG_MODE) console.log(`[ProjectileRaycastGenerator] Starting - Position: ${VectorToString(startPosition)}, Velocity: ${VectorToString(velocity)}, MaxDistance: ${distance}, SampleRate: ${sampleRate}, Gravity: ${gravity}, Interpolation: ${interpolationSteps}`);
        
        let iteration = 0;
        while (totalDistance < distance && !hit) {
            iteration++;
            
            // Store the starting position of this segment
            const segmentStart = currentPos;
            
            // Store velocity before gravity update for proper interpolation
            const velocityAtSegmentStart = currentVelocity;
            
            const gravityVec = mod.Multiply(mod.DownVector(), gravity * timeStep);
            currentVelocity = mod.Add(currentVelocity, gravityVec);
            
            const displacement = mod.Multiply(currentVelocity, timeStep);
            const nextPos = mod.Add(currentPos, displacement);
            
            if(DEBUG_MODE) {
                console.log(`[ProjectileRaycastGenerator] Iteration ${iteration} - From: ${VectorToString(currentPos)} To: ${VectorToString(nextPos)}, TotalDist: ${totalDistance.toFixed(2)}`);
            }

            const rayResult = player ? await this.castWithPlayer(player, currentPos, nextPos, debug) : await RaycastManager.cast(currentPos, nextPos, debug);
            
            if(DEBUG_MODE) {
                console.log(`[ProjectileRaycastGenerator] Iteration ${iteration} - Result: ${rayResult.hit ? "HIT" : "MISS"} at ${VectorToString(rayResult.point ?? nextPos)}`);
            }
            
            if (rayResult.hit && rayResult.point) {
                hit = true;
                
                // If hit detected callback is provided, call it to get validated position
                let finalPosition = rayResult.point;
                if (onHitDetected) {
                    if(DEBUG_MODE) {
                        console.log(`[ProjectileRaycastGenerator] Hit detected at ${VectorToString(rayResult.point)}, calling onHitDetected callback`);
                    }
                    finalPosition = await onHitDetected(rayResult.point, rayResult.normal);
                    if(DEBUG_MODE) {
                        console.log(`[ProjectileRaycastGenerator] Validated final position: ${VectorToString(finalPosition)}`);
                    }
                }
                
                // Yield interpolated points from segment start to hit point (excluding both endpoints)
                if (interpolationSteps > 0) {
                    // Calculate the time it takes to reach the hit point
                    const hitVector = Math2.Vec3.FromVector(rayResult.point).Subtract(Math2.Vec3.FromVector(segmentStart)).ToVector();
                    const hitDistance = VectorLength(hitVector);
                    const totalSegmentDistance = VectorLength(displacement);
                    const hitTimeFraction = totalSegmentDistance > 0 ? hitDistance / totalSegmentDistance : 0;
                    const hitTimeStep = hitTimeFraction * timeStep;
                    
                    for (let i = 1; i <= interpolationSteps; i++) {
                        const t = i / (interpolationSteps + 1);
                        const subTimeStep = t * hitTimeStep;
                        
                        // Use projectile motion: position = start + velocity*time + 0.5*gravity*time²
                        const velocityDisplacement = mod.Multiply(velocityAtSegmentStart, subTimeStep);
                        const gravityDisplacement = mod.Multiply(mod.DownVector(), 0.5 * gravity * subTimeStep * subTimeStep);
                        const interpPos = mod.Add(segmentStart, mod.Add(velocityDisplacement, gravityDisplacement));
                        
                        yield {
                            position: interpPos,
                            rayId: rayResult.ID,
                            hit: false,
                            isLast: false
                        };
                    }
                }
                
                // If validation callback was used and position differs from hit point, yield interpolated points to validated position
                if (onHitDetected && finalPosition !== rayResult.point) {
                    const adjustmentDistance = VectorLength(
                        Math2.Vec3.FromVector(finalPosition).Subtract(Math2.Vec3.FromVector(rayResult.point)).ToVector()
                    );
                    
                    if (adjustmentDistance > 0.1 && interpolationSteps > 0) {
                        if(DEBUG_MODE) {
                            console.log(`[ProjectileRaycastGenerator] Generating ${interpolationSteps} adjustment points from hit to validated position (distance: ${adjustmentDistance.toFixed(2)})`);
                        }
                        
                        // Generate interpolated points from hit point to validated position
                        for (let i = 1; i <= interpolationSteps; i++) {
                            const t = i / (interpolationSteps + 1);
                            const adjustmentVector = Math2.Vec3.FromVector(finalPosition).Subtract(Math2.Vec3.FromVector(rayResult.point)).ToVector();
                            const interpPos = mod.Add(rayResult.point, mod.Multiply(adjustmentVector, t));
                            
                            yield {
                                position: interpPos,
                                rayId: rayResult.ID,
                                hit: false,
                                isLast: false
                            };
                        }
                    }
                }
                
                // Yield the final validated position as the last point
                yield {
                    position: finalPosition,
                    rayId: rayResult.ID,
                    hit: true,
                    hitNormal: rayResult.normal,
                    isLast: true
                };
                break;
            }
            
            // No hit - yield interpolated points between segment start and next position (excluding start, including end)
            if (interpolationSteps > 0) {
                // Generate interpolationSteps points evenly distributed, not including start but including end
                for (let i = 1; i <= interpolationSteps + 1; i++) {
                    const t = i / (interpolationSteps + 1);
                    const subTimeStep = t * timeStep;
                    
                    // Use projectile motion: position = start + velocity*time + 0.5*gravity*time²
                    const velocityDisplacement = mod.Multiply(velocityAtSegmentStart, subTimeStep);
                    const gravityDisplacement = mod.Multiply(mod.DownVector(), 0.5 * gravity * subTimeStep * subTimeStep);
                    const interpPos = mod.Add(segmentStart, mod.Add(velocityDisplacement, gravityDisplacement));
                    
                    yield {
                        position: interpPos,
                        rayId: rayResult.ID,
                        hit: false,
                        isLast: false
                    };
                }
            } else {
                // No interpolation - just yield the endpoint
                yield {
                    position: nextPos,
                    rayId: rayResult.ID,
                    hit: false,
                    isLast: false
                };
            }
            
            // Update position and distance for next iteration
            currentPos = nextPos;
            totalDistance += VectorLength(displacement);
        }
        
        // If we didn't hit anything but reached distance limit, mark the last point
        if (!hit) {
            if(DEBUG_MODE) {
                console.log(`[ProjectileRaycastGenerator] Complete - Reached distance limit at ${totalDistance.toFixed(2)}`);
            }
        }
        
        if(DEBUG_MODE) {
            console.log(`[ProjectileRaycastGenerator] Complete - Total iterations: ${iteration}, Final hit: ${hit}, Total distance: ${totalDistance.toFixed(2)}`);
        }
    }

    /**
     * Generate evenly spaced radial directions in a horizontal plane
     * 
     * @param numDirections Number of directions to generate around a circle
     * @returns Array of normalized direction vectors (Y component = 0)
     */
    private static GenerateRadialDirections(numDirections: number): mod.Vector[] {
        const directions: mod.Vector[] = [];
        const angleStep = (Math.PI * 2) / numDirections;
        
        for (let i = 0; i < numDirections; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle);
            const z = Math.sin(angle);
            directions.push(mod.CreateVector(x, 0, z));
        }
        
        return directions;
    }

    /**
     * Validate and adjust a spawn location using radial collision checks
     * 
     * This function performs multiple passes of radial raycasts to detect nearby geometry
     * and adjust the position away from collisions. If a valid position is found, it performs
     * a downward raycast to find the ground.
     * 
     * @param centerPosition Starting position to validate
     * @param checkRadius Radius to check for collisions
     * @param numDirections Number of directions to check (evenly distributed)
     * @param downwardDistance Maximum distance for downward ground-finding raycast
     * @param maxIterations Maximum number of adjustment passes (default: 2)
     * @param debug Visualize raycasts
     * @returns Promise resolving to validated position and validity flag
     */
    static async ValidateSpawnLocationWithRadialCheck(
        centerPosition: mod.Vector,
        checkRadius: number,
        checkRadiusOffset: number,
        numDirections: number,
        downwardDistance: number,
        maxIterations: number = SPAWN_VALIDATION_MAX_ITERATIONS,
        debug: boolean = false
    ): Promise<ValidatedSpawnResult> {
        let currentPosition = centerPosition;
        let foundCollision = false;
        
        // Generate radial check directions
        const directions = RaycastManager.GenerateRadialDirections(numDirections);
        
        // Iterative adjustment passes
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            foundCollision = false;
            let adjustmentVector = mod.CreateVector(0, 0, 0);
            let collisionCount = 0;
            
            // Cast rays in all directions
            for (const direction of directions) {
                const rayStart = mod.Add(currentPosition, mod.Multiply(direction, checkRadiusOffset));
                const rayEnd = mod.Add(currentPosition, mod.Multiply(direction, checkRadius));
                const rayResult = await RaycastManager.cast(rayStart, rayEnd, debug);

                if (rayResult.hit && rayResult.point) {
                    foundCollision = true;
                    collisionCount++;
                    
                    // Calculate how much the ray penetrated into the collision radius
                    const hitVector = Math2.Vec3.FromVector(rayResult.point).Subtract(Math2.Vec3.FromVector(rayStart)).ToVector(); //mod.Subtract(rayResult.point, currentPosition);
                    const hitDistance = VectorLength(hitVector);
                    const penetrationDepth = checkRadius - hitDistance;
                    
                    // Create a conservative push vector away from the collision
                    // Direction is opposite to the hit direction
                    const pushAmount = penetrationDepth;
                    const pushVector = mod.Multiply(direction, -pushAmount);
                    adjustmentVector = mod.Add(adjustmentVector, pushVector);
                    
                    if (DEBUG_MODE) {
                        console.log(`  Iteration ${iteration}: Collision at distance ${hitDistance.toFixed(2)} (penetration: ${penetrationDepth.toFixed(2)}, push: ${pushAmount.toFixed(2)})`);
                    }
                }
            }
            
            // If we found collisions, apply the adjustment
            if (foundCollision && collisionCount > 0) {
                // Average the adjustment vector if multiple collisions
                if (collisionCount > 1) {
                    adjustmentVector = mod.Multiply(adjustmentVector, 1.0 / collisionCount);
                }
                
                currentPosition = mod.Add(currentPosition, adjustmentVector);
                
                if (DEBUG_MODE) {
                    console.log(`  Iteration ${iteration}: Adjusted position by ${VectorToString(adjustmentVector)}`);
                    console.log(`  New position: ${VectorToString(currentPosition)}`);
                }
            } else {
                // No collisions found, position is valid
                if (DEBUG_MODE) {
                    console.log(`  Iteration ${iteration}: No collisions, position is clear`);
                }
                break;
            }
        }
        
        // Perform downward raycast to find ground
        // Add height offset to ensure ray starts above ground and doesn't clip through
        const downwardRayStart = mod.Add(currentPosition, mod.CreateVector(0, SPAWN_VALIDATION_HEIGHT_OFFSET, 0));
        const downwardRayEnd = mod.Add(downwardRayStart, mod.Multiply(mod.DownVector(), downwardDistance));
        const groundResult = await RaycastManager.cast(downwardRayStart, downwardRayEnd, debug);

        console.log(`Looking for spawn location using downward ray start: ${VectorToString(downwardRayStart)}, ray end: ${VectorToString(downwardRayEnd)}`);

        let finalPosition = currentPosition;
        let isValid = true;
        
        if (groundResult.hit && groundResult.point) {
            // Preserve the adjusted X and Z coordinates from collision avoidance,
            // but use the Y coordinate from the ground hit point
            finalPosition = mod.CreateVector(
                mod.XComponentOf(currentPosition),
                mod.YComponentOf(groundResult.point),
                mod.ZComponentOf(currentPosition)
            );
            
            if (DEBUG_MODE) {
                console.log(`  Ground found at ${VectorToString(finalPosition)}`);
                console.log(`  Preserved adjusted position: X=${mod.XComponentOf(currentPosition).toFixed(6)}, Z=${mod.ZComponentOf(currentPosition).toFixed(6)}`);
            }
        } else {
            // No ground found - position is invalid
            isValid = false;
            
            if (DEBUG_MODE) {
                console.log(`  WARNING: No ground found below position`);
            }
        }
        
        // Note: We don't mark as invalid if collisions still exist after max iterations.
        // The adjusted position is still better than the unadjusted position, even if
        // some collisions remain. The only critical failure is if we can't find ground.
        if (foundCollision && DEBUG_MODE) {
            console.log(`  Note: Still have some collisions after ${maxIterations} iterations, but using adjusted position anyway`);
        }
        
        return {
            position: finalPosition,
            isValid: isValid
        };
    }
}

// Global raycast manager instance
const raycastManager = new RaycastManager();


// Capture all async raycast events and handle them with the raycast manager
export function OnRayCastHit(eventPlayer: mod.Player, eventPoint: mod.Vector, eventNormal: mod.Vector) {
    if(DEBUG_MODE) console.log("Received raycast hit");
    raycastManager.handleHit(eventPlayer, eventPoint, eventNormal);
    if(DEBUG_MODE) console.log("After handled raycast hit");
}

export function OnRayCastMissed(eventPlayer: mod.Player) {
    if(DEBUG_MODE) console.log("Received raycast miss");
    raycastManager.handleMiss(eventPlayer);
    if(DEBUG_MODE) console.log("After handled raycast miss");
}
