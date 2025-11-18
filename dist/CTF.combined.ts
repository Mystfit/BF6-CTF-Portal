//@ts-ignore
import * as modlib from 'modlib';


/* 
 * Capture the Flag Game Mode
 * 
 * Two (or more) teams compete to capture the enemy flag and return it to their base.
 * First team to reach the target score wins.
 * Author: Mystfit and Claude Sonnet 4.5 (20250929).
 */

//==============================================================================================
// HOW IT WORKS - Understanding CTF Game Flow
//==============================================================================================
/*
 * CLASSIC CTF FLAG LIFECYCLE EXPLAINED (ClassicCTFConfig game mode)
 * =========================
 * 1. AT HOME (isAtHome=true)
 *    - Flag sits at the flag spawn point with an interaction point
 *    - Opposing teams can pick up the flag by interacting with it
 *
 * 2. BEING CARRIED (isBeingCarried=true)
 *    - An player on an opposing team can pick up the flag by interacting with it to become a flag carrier  - Carrier forced to melee weapon (can't shoot)
 *    - Flag carriers can't drive vehicles (forced to passenger seat)
 *    - Flag carriers are globally visible by an icon above their head as well as a smoke trail and are forcefully spotted
 *
 * 3. DROPPED (isDropped=true)
 *    - The flag is dropped when the carrier dies or when manually dropped by the carrier switching weapons
 *    - Configurable (5 second default) delay before anyone can pick the flag up again
 *    - The flag will auto-return to base after after a configurable delay (30 second default) if not picked up
 *    - The flag's owning team can return the flag early by interacting with it
 *
 * 4. SCORING
 *    - The flag carrier enters their teams capture zone with enemy flag
 *    - The flag carrier's team flag must be at home to score
 *    - Team gets 1 point, first to TARGET_SCORE wins
 *
 * MULTI-TEAM SUPPORT (FourTeamCTFConfig game mode):
 * ===================
 * - Default is 4 teams but compatible with 3-7 teams. 
 * - Each flag can restrict which teams can capture it
 */

//==============================================================================================
// CONFIGURATION CONSTANTS
// This file contains all configuration constants that need to be loaded before other modules
//==============================================================================================

const VERSION = [2, 4, 0];

const DEBUG_MODE = false;                                            // Print extra debug messages

// Game Settings
const GAMEMODE_TARGET_SCORE = 10;                                    // Points needed to win

// Flag settings
const FLAG_PICKUP_DELAY = 5;                                        // Seconds before dropped flag can be picked up and when carrier kills are still counted
const FLAG_AUTO_RETURN_TIME = 30;                                   // Seconds before dropped flag auto-returns to base

// Flag carrier settings
const CARRIER_FORCED_WEAPON = mod.Gadgets.Melee_Sledgehammer;       // Weapon to automatically give to a flag carrier when a flag is picked up
const CARRIER_FORCED_WEAPON_SLOT = mod.InventorySlots.MeleeWeapon;  // Force flag carrier to swap to this slot on flag pickup, swapping will drop flag
const CARRIER_CAN_HOLD_MULTIPLE_FLAGS = false;                       // Let the flag carrier pick up multiple flags at once

// Team balance
const TEAM_AUTO_BALANCE: boolean = true;                            // Make sure teams are evenly balanced 
const TEAM_BALANCE_DELAY = 5.0;                                     // Seconds to delay before auto-balancing teams
const TEAM_BALANCE_CHECK_INTERVAL = 10;                             // Check balance every N seconds

// Vehicles
const VEHICLE_BLOCK_CARRIER_DRIVING: boolean = true;


//==============================================================================================
// ADDITIONAL CONSTANTS - Fine-tuning values
//==============================================================================================

// Flag placement and positioning
const FLAG_SFX_DURATION = 5.0;                                      // Time delay before alarm sound shuts off
const FLAG_ICON_HEIGHT_OFFSET = 2.5;                                // Height that the flag icon should be placed above a flag
const FLAG_INTERACTION_HEIGHT_OFFSET = 1.3;                         // Height offset for flag interaction point
const FLAG_SPAWN_HEIGHT_OFFSET = 0.5;                               // Height offset when spawning flag above ground
const FLAG_COLLISION_RADIUS = 1.5;                                  // Safety radius to prevent spawning inside objects
const FLAG_COLLISION_RADIUS_OFFSET = 1;                             // Offset the start of the radius to avoid ray collisions inside the flag
const FLAG_DROP_DISTANCE = 2.5;                                     // Distance in front of player when dropping flag
const FLAG_DROP_RAYCAST_DISTANCE = 100;                             // Maximum distance for downward raycast when dropping
const FLAG_DROP_RING_RADIUS = 2.5;                                  // Radius for multiple flags dropped in a ring pattern
const FLAG_ENABLE_ARC_THROW = true;                                 // True = Enable flag throwing, False = simple wall + ground detection for dropped flag
const FLAG_THROW_SPEED = 5;                                         // Speed in units p/s to throw a flag away from a player
const FLAG_FOLLOW_DISTANCE = 3;                                     // Distance flag will follow the player at
const FLAG_FOLLOW_POSITION_SMOOTHING = 0.5;                         // Exponential smoothing factor for position (0-1, lower = smoother)
const FLAG_FOLLOW_ROTATION_SMOOTHING = 0.5;                         // Exponential smoothing factor for rotation (0-1, lower = smoother)
const FLAG_FOLLOW_SAMPLES = 20;
const FLAG_TERRAIN_RAYCAST_SUPPORT = true;                         // TODO: Temp hack until terrain raycasts fixed. Do we support raycasts against terrain?
const FLAG_PROP = mod.RuntimeSpawn_Common.MCOM;                     // Prop representing a flag at a spawner and when dropped
const FLAG_FOLLOW_MODE = false;                                     // Flag follows the player.
const FLAG_TERRAIN_FIX_PROTECTION = false;                          // FIXES TERRAIN RAYCAST BUG: Flag will not drop under the player's Y position when thrown
const SOLDIER_HALF_HEIGHT = 0.75;                                   // Midpoint of a soldier used for raycasts
const SOLDIER_HEIGHT = 2;                                           // Full soldier height

// Spawn validation settings
const SPAWN_VALIDATION_DIRECTIONS = 4;                              // Number of radial check directions
const SPAWN_VALIDATION_MAX_ITERATIONS = 1;                          // Maximum adjustment passes
const SPAWN_VALIDATION_HEIGHT_OFFSET = 0.75;                        // Height offset above adjusted position for ground detection ray

// Vehicle seat indices
const VEHICLE_DRIVER_SEAT = 0;                                      // Driver seat index in vehicles
const VEHICLE_FIRST_PASSENGER_SEAT = 1;                             // First passenger seat index

// Update rates
const TICK_RATE = 0.032;                                            // ~30fps update rate for carrier position updates (portal server tickrate)


//==============================================================================================
// COLOR & UTILITY CLASSES
//==============================================================================================

/**
 * RGBA color class with conversion utilities for the mod API.
 * Handles color normalization and conversion to mod.Vector format.
 */
class rgba {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r:number, g:number, b:number, a?:number){
        this.r = r;
        this.g =  g;
        this.b = b;
        this.a = a ? a : 255;
    }

    NormalizeToLinear(): rgba {
        return new rgba(this.r / 255, this.g / 255, this.b / 255, this.a / 255);
    }

    AsModVector3(): mod.Vector {
        return mod.CreateVector(this.r, this.g, this.b);
    }

    static FromModVector3(vector: mod.Vector): rgba {
        return new rgba(mod.XComponentOf(vector), mod.YComponentOf(vector), mod.ZComponentOf(vector));
    }
}

// Colors
const NEUTRAL_COLOR = new rgba(255, 255, 255, 1).NormalizeToLinear().AsModVector3();
const DEFAULT_TEAM_COLOURS = new Map<number, mod.Vector>([
    [TeamID.TEAM_NEUTRAL, NEUTRAL_COLOR],
    [TeamID.TEAM_1, new rgba(216, 6, 249, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_2, new rgba(249, 95, 6, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_3, new rgba(39, 249, 6, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_4, new rgba(4, 103, 252, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_5, new rgba(249, 6, 6, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_6, new rgba(233, 249, 6, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_7, new rgba(133, 133, 133, 1).NormalizeToLinear().AsModVector3()]
]);


//==============================================================================================
// MATH FUNCTIONS
//==============================================================================================

export namespace Math2 {
    export class Vec3 {
        x: number = 0;
        y: number = 0;
        z: number = 0;

        constructor(x: number, y: number, z:number){
            this.x = x;
            this.y = y;
            this.z = z;
        }

        static FromVector(vector: mod.Vector): Vec3 {
            let x = mod.XComponentOf(vector);
            let y = mod.YComponentOf(vector);
            let z = mod.ZComponentOf(vector);
            
            // Check for NaN or undefined values and default to 0
            if (isNaN(x) || x === undefined) x = 0;
            if (isNaN(y) || y === undefined) y = 0;
            if (isNaN(z) || z === undefined) z = 0;
            
            return new Vec3(x, y, z);
        }

        ToVector(): mod.Vector {
            return mod.CreateVector(this.x, this.y, this.z);
        }

        Subtract(other:Vec3): Vec3 {
            return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
        }

        Multiply(other:Vec3): Vec3 {
            return new Vec3(this.x * other.x, this.y * other.y, this.z * other.z);
        }

        MultiplyScalar(scalar:number): Vec3 {
            return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
        }

        Add(other:Vec3): Vec3 {
            return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
        }

        /**
         * Calculates the length of this vector
         * @returns The magnitude/length of the vector
         */
        Length(): number {
            return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        }

        /**
         * Normalizes this vector (returns a unit vector in the same direction)
         * @returns A normalized copy of this vector, or zero vector if length is 0
         */
        Normalize(): Vec3 {
            const len = this.Length();
            if (len < 1e-9) {
                return new Vec3(0, 0, 0);
            }
            return new Vec3(this.x / len, this.y / len, this.z / len);
        }

        /**
         * Converts a directional vector to Euler angles in radians for use with mod.CreateTransform().
         * Uses the Battlefield Portal coordinate system:
         * - X-axis: left (-1, 0, 0) to right (1, 0, 0)
         * - Y-axis: down (0, -1, 0) to up (0, 1, 0)
         * - Z-axis: forward (0, 0, -1) to backward (0, 0, 1)
         * 
         * Returns Vec3 where each component represents rotation around that axis:
         * - x = rotation around X-axis (pitch - vertical tilt)
         * - y = rotation around Y-axis (yaw - horizontal rotation)
         * - z = rotation around Z-axis (roll - barrel roll, set to 0 as direction alone can't determine this)
         * 
         * Handles gimbal lock cases (when pointing straight up/down)
         * 
         * @returns Vec3 containing rotations around (X, Y, Z) axes in radians
         */
        DirectionToEuler(): Vec3 {
            // Normalize the direction vector to ensure consistent results
            const normalized = this.Normalize();
            
            // Handle zero vector case
            if (normalized.Length() < 1e-9) {
                return new Vec3(0, 0, 0);
            }

            const x = normalized.x;
            const y = normalized.y;
            const z = normalized.z;

            // Calculate yaw (rotation around Y-axis in horizontal plane)
            // Since forward is (0, 0, -1), we use atan2(-x, -z)
            // Negated to match the rotation direction expected by the engine
            const yaw = Math.atan2(-x, -z);

            // Calculate pitch (rotation around X-axis for vertical tilt)
            // Use atan2 for better handling of edge cases
            // Horizontal length in the XZ plane
            // Negated to match the rotation direction expected by the engine
            const horizontalLength = Math.sqrt(x * x + z * z);
            const pitch = Math.atan2(y, horizontalLength);

            // Roll cannot be determined from direction vector alone
            // (it would require an "up" vector to fully define orientation)
            // Set to 0 as a sensible default
            const roll = 0;

            // Return in the format expected by CreateTransform: (pitch, yaw, roll)
            // which corresponds to rotations around (X-axis, Y-axis, Z-axis)
            return new Vec3(pitch, yaw, roll);
        }

        ToString(): string {
            return `X:${this.x}, Y:${this.y}, Z:${this.z}`;
        }
    }

    export function Remap(value:number, inMin:number, inMax:number, outMin:number, outMax:number): number {
        return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
    }

    export function TriangleWave(time:number, period:number, amplitude:number):number {
        return amplitude - Math.abs((time % (2 * period)) - period);
    } 
}

/**
 * Linear interpolation between two vectors
 * @param start Starting vector
 * @param end Ending vector
 * @param alpha Interpolation factor (0.0 = start, 1.0 = end)
 * @returns Interpolated vector between start and end
 */
function LerpVector(start: mod.Vector, end: mod.Vector, alpha: number): mod.Vector {
    // Clamp alpha to [0, 1] range
    alpha = Math.max(0, Math.min(1, alpha));
    
    // Linear interpolation formula: result = start + (end - start) * alpha
    // Which is equivalent to: result = start * (1 - alpha) + end * alpha
    const startFloat = Math2.Vec3.FromVector(start);
    const endFloat = Math2.Vec3.FromVector(end);
    const delta = endFloat.Subtract(startFloat);
    const scaledDelta = delta.MultiplyScalar(alpha);
    const final = startFloat.Add(scaledDelta);
    return final.ToVector();
}

function InterpolatePoints(points: mod.Vector[], numPoints:number): mod.Vector[] {
    if(points.length < 2){
        console.log("Need 1+ points to interpolate");
        return points;
    }

    let interpolatedPoints: mod.Vector[] = [];
    for(let [pointIdx, point] of points.entries()){
        if(pointIdx < points.length - 1){
            // Get current and next point
            let currentPoint = points[pointIdx];
            let nextPoint = points[pointIdx + 1];
            interpolatedPoints.push(currentPoint);

            for(let interpIdx = 1; interpIdx < numPoints; ++interpIdx){
                let alpha: number = interpIdx / numPoints;
                let interpVector = LerpVector(currentPoint, nextPoint, alpha);
                console.log(`${interpIdx} | Start: ${VectorToString(currentPoint)}, End: ${VectorToString(nextPoint)}, Alpha: ${alpha}, Interp: ${VectorToString(interpVector)}}`);
                interpolatedPoints.push(interpVector);
            }

            interpolatedPoints.push(nextPoint);
        }
    }

    return interpolatedPoints;
}


function VectorToString(v: mod.Vector): string {
    return `X: ${mod.XComponentOf(v)}, Y: ${mod.YComponentOf(v)}, Z: ${mod.ZComponentOf(v)}`
}

function VectorLength(vec: mod.Vector): number{
    return Math.sqrt(VectorLengthSquared(vec));
}

function VectorLengthSquared(vec: mod.Vector): number{
    let xLength = mod.XComponentOf(vec);
    let yLength = mod.YComponentOf(vec);
    let zLength = mod.ZComponentOf(vec);
    
    // Check for NaN or undefined values and default to 0
    if (isNaN(xLength) || xLength === undefined) xLength = 0;
    if (isNaN(yLength) || yLength === undefined) yLength = 0;
    if (isNaN(zLength) || zLength === undefined) zLength = 0;
    
    return (xLength * xLength) + (yLength * yLength) + (zLength * zLength);
}

function VectorClampToRange(vector: mod.Vector, min:number, max:number): mod.Vector{
    return mod.CreateVector(
        Math.min(Math.max(mod.XComponentOf(vector), min), max),
        Math.min(Math.max(mod.YComponentOf(vector), min), max),
        Math.min(Math.max(mod.ZComponentOf(vector), min), max),
    );
}

/**
 * Calculate Euler rotation to face a direction vector
 * @param direction Direction vector to face
 * @returns Rotation vector (Euler angles in radians)
 */
function VectorDirectionToRotation(direction: mod.Vector): mod.Vector {
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

function AreFloatsEqual(a: number, b: number, epsilon?: number): boolean
{
    return Math.abs(a - b) < (epsilon ?? 1e-9);
}

function AreVectorsEqual(a: mod.Vector, b: mod.Vector, epsilon?: number): boolean
{
    return AreFloatsEqual(mod.XComponentOf(a), mod.XComponentOf(b), epsilon) &&
        AreFloatsEqual(mod.YComponentOf(a), mod.YComponentOf(b), epsilon) &&
        AreFloatsEqual(mod.ZComponentOf(a), mod.ZComponentOf(b), epsilon);
}


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
        maxYDistance?: number,
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

            // Cast ray or clamp to maximum drop distance and assume hit
            let rayResult: RaycastResult = { hit: false, ID: -1, point:ZERO_VEC };
            if(maxYDistance){
                if(mod.YComponentOf(nextPos) < maxYDistance){
                    rayResult = {hit: true, ID:-1, point: mod.CreateVector(mod.XComponentOf(nextPos), maxYDistance, mod.ZComponentOf(nextPos))};
                    yield {
                        position: rayResult.point,
                        rayId: -1,
                        hit: true,
                        hitNormal: mod.UpVector(),
                        isLast: true
                    };
                } else {
                    rayResult = player ? await this.castWithPlayer(player, currentPos, nextPos, debug) : await RaycastManager.cast(currentPos, nextPos, debug);
                }
            } else {
                rayResult = player ? await this.castWithPlayer(player, currentPos, nextPos, debug) : await RaycastManager.cast(currentPos, nextPos, debug);
            }
            
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
                        
                        // Use projectile motion: position = start + velocity*time + 0.5*gravity*timeÂ²
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
                    
                    // Use projectile motion: position = start + velocity*time + 0.5*gravity*timeÂ²
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
            console.log(`Before displacement vec: ${VectorToString(displacement)}`);
            console.log(`After displacement vec length: ${VectorLength(displacement)}`);
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
        debug: boolean = false,
        maxYDistance?: number | undefined
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


//==============================================================================================
// ANIMATION MANAGER
//==============================================================================================

/**
 * AnimationManager - Asynchronous object and value animation system
 *
 * Provides complex animation capabilities for both spatial objects and arbitrary numeric values.
 * Supports path-based animations, easing functions, speed/duration control, and callbacks.
 *
 * =========================================================================================
 * SPATIAL OBJECT ANIMATION
 * =========================================================================================
 *
 * Animate objects along paths in 3D space:
 *
 * @example Basic path animation
 * await animationManager.AnimateAlongPath(object, [pos1, pos2, pos3], { speed: 10 });
 *
 * @example Concurrent path generation
 * const generator = RaycastManager.ProjectileRaycastGenerator(start, velocity, distance, sampleRate);
 * await animationManager.AnimateAlongGeneratedPath(undefined, generator, 3, {
 *     speed: 50,
 *     onSpawnAtStart: () => mod.SpawnObject(mod.RuntimeSpawn_Common.Sphere01, start),
 *     onComplete: () => console.log("Projectile reached destination")
 * });
 *
 * =========================================================================================
 * VALUE ANIMATION WITH EASING
 * =========================================================================================
 *
 * Animate arbitrary numeric values with easing functions for smooth UI animations:
 *
 * @example Fade in UI element
 * await animationManager.AnimateValue(0, 1, {
 *     duration: 0.5,
 *     easingFunction: Easing.EaseOutCubic,
 *     onProgress: (alpha) => {
 *         mod.SetUIWidgetBgAlpha(element, alpha);
 *     }
 * });
 *
 * @example Scale bounce effect
 * await animationManager.AnimateValue(0, 1.2, {
 *     duration: 0.8,
 *     easingFunction: Easing.EaseOutBounce,
 *     onProgress: (scale) => {
 *         mod.SetUIWidgetSize(element, mod.CreateVector(scale,scale,0));
 *     }
 * });
 *
 * @example Sliding panel with overshoot
 * await animationManager.AnimateValue(-200, 0, {
 *     duration: 0.6,
 *     easingFunction: Easing.EaseOutBack,
 *     onProgress: (xPos) => {
 *         mod.mod.SetUIWidgetPosition(panel, mod.CreateVector(xPos, 100, 0));
 *     }
 * });
 *
 * @example Looping pulse animation
 * animationManager.AnimateValue(0.5, 1.0, {
 *     duration: 1.0,
 *     easingFunction: Easing.EaseInOutSine,
 *     loop: true,
 *     onProgress: (alpha) => {
 *         mod.SetUIWidgetBgAlpha(indicator, alpha);
 *     }
 * });
 *
 * =========================================================================================
 * MULTI-VALUE ANIMATION
 * =========================================================================================
 *
 * Animate multiple values in parallel (useful for RGB colors, positions, etc.):
 *
 * @example RGB color transition
 * await animationManager.AnimateValues([255, 0, 0], [0, 0, 255], {
 *     duration: 1.0,
 *     easingFunction: Easing.EaseInOutCubic,
 *     onProgress: ([r, g, b]) => {
 *         const color = mod.CreateVector(r / 255, g / 255, b / 255);
 *         mod.SetUIWidgetBgColor(element, color);
 *     }
 * });
 *
 * @example Position and scale simultaneously
 * await animationManager.AnimateValues([0, 0, 0.5], [100, 50, 1.5], {
 *     duration: 0.8,
 *     easingFunction: Easing.EaseOutBack,
 *     onProgress: ([x, y, scale]) => {
 *         mod.SetUIWidgetPosition(element, mod.CreateVector(x, y, 0));
 *         mod.SetUIWidgetSize(element, mod.CreateVector(scale, scale, 0));
 *     }
 * });
 *
 * =========================================================================================
 * AVAILABLE EASING FUNCTIONS
 * =========================================================================================
 *
 * All easing functions are available in the Easing namespace:
 *
 * - Linear: No easing, constant speed
 * - Quad/Cubic/Quart/Quint: Polynomial curves (In, Out, InOut variants)
 * - Sine: Smooth sinusoidal easing (In, Out, InOut variants)
 * - Expo: Exponential acceleration/deceleration (In, Out, InOut variants)
 * - Circ: Circular easing (In, Out, InOut variants)
 * - Bounce: Bouncing effect (In, Out, InOut variants)
 * - Elastic: Elastic spring effect (In, Out, InOut variants)
 * - Back: Overshooting easing (In, Out, InOut variants)
 *
 * Naming convention:
 * - EaseIn*: Slow start, fast end
 * - EaseOut*: Fast start, slow end
 * - EaseInOut*: Slow start, fast middle, slow end
 *
 * @example Comparing easing functions
 * // Gentle fade
 * easingFunction: Easing.EaseInOutSine
 *
 * // Dramatic acceleration
 * easingFunction: Easing.EaseInQuart
 *
 * // Bouncy overshoot
 * easingFunction: Easing.EaseOutBack
 *
 * // Springy bounce
 * easingFunction: Easing.EaseOutBounce
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
    rotation?: mod.Vector;       // Manual rotation to set when animating
    rotationSpeed?: number;      // How fast to rotate in degrees/second (default: instant)
    loop?: boolean;              // Loop the animation
    reverse?: boolean;           // Reverse after completion
    onSpawnAtStart?: () => mod.Object | null;
    onStart?: () => void;
    onProgress?: (progress: number, position: mod.Vector) => void;
    onComplete?: () => void;
    onSegmentComplete?: (segmentIndex: number) => void;
}

interface ValueAnimationOptions {
    duration: number;                                              // Total duration in seconds
    easingFunction?: EasingFunction;                               // Easing curve (default: Linear)
    onProgress: (value: number, normalizedTime: number) => void;   // Called each tick with interpolated value
    onStart?: () => void;                                          // Called when animation starts
    onComplete?: () => void;                                       // Called when animation completes
    tickRate?: number;                                             // Seconds per tick (default: 0.032 ~30fps)
    loop?: boolean;                                                // Loop the animation
}

type EasingFunction = (t: number) => number;  // t in [0,1] -> output in [0,1]

//==============================================================================================
// EASING FUNCTIONS
//==============================================================================================

/**
 * Easing - Collection of easing/tweening functions for smooth animations
 *
 * All functions take t in [0,1] and return output in [0,1]
 *
 * Usage:
 *   await animationManager.AnimateValue(0, 100, {
 *       duration: 1.0,
 *       easingFunction: Easing.EaseOutBounce,
 *       onProgress: (value) => console.log(value)
 *   });
 */
namespace Easing {
    // Linear
    export function Linear(t: number): number {
        return t;
    }

    // Quadratic
    export function EaseInQuad(t: number): number {
        return t * t;
    }

    export function EaseOutQuad(t: number): number {
        return t * (2 - t);
    }

    export function EaseInOutQuad(t: number): number {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    // Cubic
    export function EaseInCubic(t: number): number {
        return t * t * t;
    }

    export function EaseOutCubic(t: number): number {
        const t1 = t - 1;
        return t1 * t1 * t1 + 1;
    }

    export function EaseInOutCubic(t: number): number {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }

    // Quartic
    export function EaseInQuart(t: number): number {
        return t * t * t * t;
    }

    export function EaseOutQuart(t: number): number {
        const t1 = t - 1;
        return 1 - t1 * t1 * t1 * t1;
    }

    export function EaseInOutQuart(t: number): number {
        if (t < 0.5) {
            return 8 * t * t * t * t;
        } else {
            const t1 = t - 1;
            return 1 - 8 * t1 * t1 * t1 * t1;
        }
    }

    // Quintic
    export function EaseInQuint(t: number): number {
        return t * t * t * t * t;
    }

    export function EaseOutQuint(t: number): number {
        const t1 = t - 1;
        return 1 + t1 * t1 * t1 * t1 * t1;
    }

    export function EaseInOutQuint(t: number): number {
        if (t < 0.5) {
            return 16 * t * t * t * t * t;
        } else {
            const t1 = t - 1;
            return 1 + 16 * t1 * t1 * t1 * t1 * t1;
        }
    }

    // Sine
    export function EaseInSine(t: number): number {
        return 1 - Math.cos((t * Math.PI) / 2);
    }

    export function EaseOutSine(t: number): number {
        return Math.sin((t * Math.PI) / 2);
    }

    export function EaseInOutSine(t: number): number {
        return -(Math.cos(Math.PI * t) - 1) / 2;
    }

    // Exponential
    export function EaseInExpo(t: number): number {
        return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    }

    export function EaseOutExpo(t: number): number {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    export function EaseInOutExpo(t: number): number {
        if (t === 0) return 0;
        if (t === 1) return 1;
        if (t < 0.5) {
            return Math.pow(2, 20 * t - 10) / 2;
        } else {
            return (2 - Math.pow(2, -20 * t + 10)) / 2;
        }
    }

    // Circular
    export function EaseInCirc(t: number): number {
        return 1 - Math.sqrt(1 - t * t);
    }

    export function EaseOutCirc(t: number): number {
        return Math.sqrt(1 - Math.pow(t - 1, 2));
    }

    export function EaseInOutCirc(t: number): number {
        if (t < 0.5) {
            return (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2;
        } else {
            return (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
        }
    }

    // Bounce
    export function EaseInBounce(t: number): number {
        return 1 - EaseOutBounce(1 - t);
    }

    export function EaseOutBounce(t: number): number {
        const n1 = 7.5625;
        const d1 = 2.75;

        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            const t2 = t - 1.5 / d1;
            return n1 * t2 * t2 + 0.75;
        } else if (t < 2.5 / d1) {
            const t2 = t - 2.25 / d1;
            return n1 * t2 * t2 + 0.9375;
        } else {
            const t2 = t - 2.625 / d1;
            return n1 * t2 * t2 + 0.984375;
        }
    }

    export function EaseInOutBounce(t: number): number {
        if (t < 0.5) {
            return (1 - EaseOutBounce(1 - 2 * t)) / 2;
        } else {
            return (1 + EaseOutBounce(2 * t - 1)) / 2;
        }
    }

    // Elastic
    export function EaseInElastic(t: number): number {
        const c4 = (2 * Math.PI) / 3;

        if (t === 0) return 0;
        if (t === 1) return 1;
        return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    }

    export function EaseOutElastic(t: number): number {
        const c4 = (2 * Math.PI) / 3;

        if (t === 0) return 0;
        if (t === 1) return 1;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    export function EaseInOutElastic(t: number): number {
        const c5 = (2 * Math.PI) / 4.5;

        if (t === 0) return 0;
        if (t === 1) return 1;
        if (t < 0.5) {
            return -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2;
        } else {
            return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
        }
    }

    // Back (overshooting)
    export function EaseInBack(t: number): number {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return c3 * t * t * t - c1 * t * t;
    }

    export function EaseOutBack(t: number): number {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const t1 = t - 1;
        return 1 + c3 * t1 * t1 * t1 + c1 * t1 * t1;
    }

    export function EaseInOutBack(t: number): number {
        const c1 = 1.70158;
        const c2 = c1 * 1.525;

        if (t < 0.5) {
            return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
        } else {
            const t2 = 2 * t - 2;
            return (Math.pow(t2, 2) * ((c2 + 1) * t2 + c2) + 2) / 2;
        }
    }
}

interface ActiveAnimation {
    object: mod.Object | undefined;
    objectId: number | undefined;
    cancelled: boolean;
    paused: boolean;
    progress: number;
}

class AnimationManager {
    private activeAnimations: Map<number, ActiveAnimation> = new Map();
    private debugMode: boolean;
    private tickRate: number;
    private zeroVec: mod.Vector;

    constructor(
        debugMode: boolean = false,
        tickRate: number = 0.032,
        zeroVec: mod.Vector = mod.CreateVector(0, 0, 0)
    ) {
        this.debugMode = debugMode;
        this.tickRate = tickRate;
        this.zeroVec = zeroVec;
    }

    //==============================================================================================
    // PRIVATE HELPER CLASSES
    //==============================================================================================

    /**
     * Simple 3D Vector helper class for internal animation calculations
     * Inlined from Math.ts with basic arithmetic operations
     */
    private static Vec3 = class {
        x: number;
        y: number;
        z: number;

        constructor(x: number, y: number, z: number) {
            this.x = x;
            this.y = y;
            this.z = z;
        }

        static FromVector(vector: mod.Vector): InstanceType<typeof AnimationManager.Vec3> {
            let x = mod.XComponentOf(vector);
            let y = mod.YComponentOf(vector);
            let z = mod.ZComponentOf(vector);

            // Check for NaN or undefined values and default to 0
            if (isNaN(x) || x === undefined) x = 0;
            if (isNaN(y) || y === undefined) y = 0;
            if (isNaN(z) || z === undefined) z = 0;

            return new AnimationManager.Vec3(x, y, z);
        }

        ToVector(): mod.Vector {
            return mod.CreateVector(this.x, this.y, this.z);
        }

        Add(other: InstanceType<typeof AnimationManager.Vec3>): InstanceType<typeof AnimationManager.Vec3> {
            return new AnimationManager.Vec3(
                this.x + other.x,
                this.y + other.y,
                this.z + other.z
            );
        }

        Subtract(other: InstanceType<typeof AnimationManager.Vec3>): InstanceType<typeof AnimationManager.Vec3> {
            return new AnimationManager.Vec3(
                this.x - other.x,
                this.y - other.y,
                this.z - other.z
            );
        }

        Multiply(other: InstanceType<typeof AnimationManager.Vec3>): InstanceType<typeof AnimationManager.Vec3> {
            return new AnimationManager.Vec3(
                this.x * other.x,
                this.y * other.y,
                this.z * other.z
            );
        }

        MultiplyScalar(scalar: number): InstanceType<typeof AnimationManager.Vec3> {
            return new AnimationManager.Vec3(
                this.x * scalar,
                this.y * scalar,
                this.z * scalar
            );
        }

        Divide(other: InstanceType<typeof AnimationManager.Vec3>): InstanceType<typeof AnimationManager.Vec3> {
            return new AnimationManager.Vec3(
                this.x / other.x,
                this.y / other.y,
                this.z / other.z
            );
        }

        DivideScalar(scalar: number): InstanceType<typeof AnimationManager.Vec3> {
            return new AnimationManager.Vec3(
                this.x / scalar,
                this.y / scalar,
                this.z / scalar
            );
        }

        Length(): number {
            return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        }

        LengthSquared(): number {
            return (this.x * this.x) + (this.y * this.y) + (this.z * this.z);
        }

        Normalize(): InstanceType<typeof AnimationManager.Vec3> {
            const len = this.Length();
            if (len < 1e-9) {
                return new AnimationManager.Vec3(0, 0, 0);
            }
            return new AnimationManager.Vec3(
                this.x / len,
                this.y / len,
                this.z / len
            );
        }

        ToString(): string {
            return `X:${this.x}, Y:${this.y}, Z:${this.z}`;
        }
    };

    //==============================================================================================
    // INLINED UTILITY METHODS
    //==============================================================================================

    /**
     * Convert vector to readable string format
     * Math.ts
     */
    private static VectorToString(v: mod.Vector): string {
        return `X: ${mod.XComponentOf(v)}, Y: ${mod.YComponentOf(v)}, Z: ${mod.ZComponentOf(v)}`;
    }

    /**
     * Calculate vector magnitude/length
     * Math.ts
     */
    private static VectorLength(vec: mod.Vector): number {
        const x = mod.XComponentOf(vec);
        const y = mod.YComponentOf(vec);
        const z = mod.ZComponentOf(vec);
        return Math.sqrt(x * x + y * y + z * z);
    }

    /**
     * Convert direction vector to Euler rotation angles
     * Math.ts
     */
    private static VectorDirectionToRotation(direction: mod.Vector): mod.Vector {
        const normalized = mod.Normalize(direction);
        const x = mod.XComponentOf(normalized);
        const y = mod.YComponentOf(normalized);
        const z = mod.ZComponentOf(normalized);
        const yaw = Math.atan2(x, -z);
        const horizontalDist = Math.sqrt(x * x + z * z);
        const pitch = Math.atan2(y, horizontalDist);
        return mod.CreateVector(pitch, yaw, 0);
    }

    //==============================================================================================
    // PUBLIC ANIMATION METHODS
    //==============================================================================================

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
                totalDistance += AnimationManager.VectorLength(AnimationManager.Vec3.FromVector(points[i + 1]).Subtract(AnimationManager.Vec3.FromVector(points[i])).ToVector()); //mod.Subtract(points[i + 1], points[i]));
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
                const segmentDistance = AnimationManager.VectorLength(AnimationManager.Vec3.FromVector(endPoint).Subtract(AnimationManager.Vec3.FromVector(startPoint)).ToVector()); //mod.Subtract(endPoint, startPoint));
                const segmentDuration = (segmentDistance / totalDistance) * totalDuration;

                // Calculate rotation if needed
                let rotation = this.zeroVec;
                if (options.rotateToDirection) {
                    rotation = AnimationManager.VectorDirectionToRotation(
                        AnimationManager.Vec3.FromVector(endPoint).Subtract(AnimationManager.Vec3.FromVector(startPoint)).ToVector() //mod.Subtract(endPoint, startPoint)
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
        const positionDelta = AnimationManager.Vec3.FromVector(endPos).Subtract(AnimationManager.Vec3.FromVector(startPos)).ToVector(); //mod.Subtract(endPos, startPos);
        const rotationDelta = options.rotation || this.zeroVec;

        if (this.debugMode) {
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
        object: mod.Object | undefined,
        generator: AsyncGenerator<ProjectilePoint>,
        minBufferSize: number,
        options: AnimationOptions = {}
    ): Promise<void> {
        const pointBuffer: ProjectilePoint[] = [];
        let generatorComplete = false;
        let currentPosition: mod.Vector;
        let animationStarted = false;
        let bufferStarvationCount = 0;
        let objectId: number = -1;

        try {
            if(this.debugMode) console.log(`[AnimateAlongGeneratedPath] Starting concurrent animation with buffer size ${minBufferSize}`);

            // Phase 1: Fill initial buffer (minBufferSize + 2 points)
            const initialBufferSize = minBufferSize;
            for (let i = 0; i < initialBufferSize; i++) {
                const result = await generator.next();
                if (result.done) {
                    generatorComplete = true;
                    break;
                }
                pointBuffer.push(result.value);

                if(this.debugMode) {
                    console.log(`[AnimateAlongGeneratedPath] Buffered point ${i + 1}/${initialBufferSize}: ${AnimationManager.VectorToString(result.value.position)}`);
                }
            }

            if (pointBuffer.length < 2) {
                console.error("AnimateAlongGeneratedPath: Not enough points generated for animation");
                return;
            }

            // Set starting position
            currentPosition = pointBuffer[0].position;

            if(this.debugMode) {
                console.log(`[AnimateAlongGeneratedPath] Initial buffer filled with ${pointBuffer.length} points, starting animation`);
            }

            // Phase 2: Concurrent animation and generation
            animationStarted = true;
            let segmentIndex = 0;

            let animation: ActiveAnimation;
            
            // Make sure we have an object to animate
            if(!object && options.onSpawnAtStart){
                let spawnedObj = options.onSpawnAtStart();
                if(spawnedObj)
                    object = spawnedObj;

                if(!object){
                    console.log("Could not spawn object for AnimateAlongGeneratedPath");
                    return;
                }
            } else {
                console.log("No valid object provided to AnimateAlongGeneratedPath");
                return;
            }

            // Set up our object
            objectId = object ? mod.GetObjId(object) : -1;
            animation = {
                object,
                objectId,
                cancelled: false,
                paused: false,
                progress: 0
            }
            this.activeAnimations.set(objectId, animation);
        
            // Let the caller know the animation has enough points and has started
            if(options.onStart)
                options.onStart();
            
            while (pointBuffer.length > 1 || !generatorComplete) {
                if (animation.cancelled) break;

                // Check if we need to wait for more points
                if (pointBuffer.length <= minBufferSize && !generatorComplete) {
                    if(this.debugMode) {
                        console.log(`[AnimateAlongGeneratedPath] Buffer low (${pointBuffer.length} points), waiting for generator...`);
                    }
                    bufferStarvationCount++;

                    // Try to fill buffer back up
                    const result = await generator.next();
                    if (result.done) {
                        generatorComplete = true;
                        if(this.debugMode) console.log(`[AnimateAlongGeneratedPath] Generator completed`);
                    } else {
                        pointBuffer.push(result.value);
                        if(this.debugMode) {
                            console.log(`[AnimateAlongGeneratedPath] Added point to buffer: ${AnimationManager.VectorToString(result.value.position)}`);
                        }
                    }
                    continue;
                }

                // If generator is still running and buffer has room, try to add more points
                if (!generatorComplete && pointBuffer.length < initialBufferSize * 2) {
                    const result = await generator.next();
                    if (result.done) {
                        generatorComplete = true;
                        if(this.debugMode) console.log(`[AnimateAlongGeneratedPath] Generator completed`);
                    } else {
                        pointBuffer.push(result.value);
                    }
                }

                // Check if we should stop consuming points (hit detected or at end)
                const shouldStopConsuming = generatorComplete && pointBuffer.length <= minBufferSize + 2;

                if (shouldStopConsuming) {
                    if(this.debugMode) {
                        console.log(`[AnimateAlongGeneratedPath] Stopping animation consumption, ${pointBuffer.length} points remaining in buffer`);
                    }
                    break;
                }

                // Animate to next point
                if (pointBuffer.length > 1) {
                    const startPoint = pointBuffer.shift()!; // Remove first point
                    const endPoint = pointBuffer[0]; // Peek at next point (don't remove yet)

                    const segmentDistance = AnimationManager.VectorLength(
                        AnimationManager.Vec3.FromVector(endPoint.position)
                            .Subtract(AnimationManager.Vec3.FromVector(startPoint.position))
                            .ToVector()
                    );

                    const segmentDuration = options.speed ? segmentDistance / options.speed : 0.1;

                    if(this.debugMode) {
                        console.log(`[AnimateAlongGeneratedPath] Animating segment ${segmentIndex}: ${AnimationManager.VectorToString(startPoint.position)} -> ${AnimationManager.VectorToString(endPoint.position)} (${segmentDistance.toFixed(2)} units, ${segmentDuration.toFixed(3)}s, buffer: ${pointBuffer.length})`);
                    }

                    // Calculate rotation if needed
                    let rotation = this.zeroVec;
                    if (options.rotateToDirection) {
                        rotation = AnimationManager.VectorDirectionToRotation(
                            AnimationManager.Vec3.FromVector(endPoint.position)
                                .Subtract(AnimationManager.Vec3.FromVector(startPoint.position))
                                .ToVector()
                        );
                    } else if(options.rotation){
                        rotation = options.rotation;
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
                if(this.debugMode) {
                    console.log(`[AnimateAlongGeneratedPath] Animating through ${pointBuffer.length} remaining buffered points`);
                }
                
                // Animate through all remaining points in buffer
                while (pointBuffer.length > 0) {
                    const startPoint = pointBuffer.shift()!;
                    
                    // If there's a next point, animate to it; otherwise we're at the last point
                    if (pointBuffer.length > 0) {
                        const endPoint = pointBuffer[0];

                        const segmentDistance = AnimationManager.VectorLength(
                            AnimationManager.Vec3.FromVector(endPoint.position)
                                .Subtract(AnimationManager.Vec3.FromVector(startPoint.position))
                                .ToVector()
                        );

                        const segmentDuration = options.speed ? segmentDistance / options.speed : 0.1;

                        let rotation = this.zeroVec;
                        if (options.rotateToDirection) {
                            rotation = AnimationManager.VectorDirectionToRotation(
                                AnimationManager.Vec3.FromVector(endPoint.position)
                                    .Subtract(AnimationManager.Vec3.FromVector(startPoint.position))
                                    .ToVector()
                            );
                        } else if(options.rotation){
                            rotation = options.rotation;
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
                        if(this.debugMode) {
                            console.log(`[AnimateAlongGeneratedPath] Reached final point: ${AnimationManager.VectorToString(startPoint.position)}`);
                        }
                        const finalDistance = AnimationManager.VectorLength(
                            AnimationManager.Vec3.FromVector(startPoint.position)
                                .Subtract(AnimationManager.Vec3.FromVector(currentPosition))
                                .ToVector()
                        );

                        if (finalDistance > 0.1) {
                            const finalDuration = options.speed ? finalDistance / options.speed : 0.1;

                            let finalRotation = this.zeroVec;
                            if (options.rotateToDirection) {
                                finalRotation = AnimationManager.VectorDirectionToRotation(
                                    AnimationManager.Vec3.FromVector(startPoint.position)
                                        .Subtract(AnimationManager.Vec3.FromVector(currentPosition))
                                        .ToVector()
                                );
                            } else if(options.rotation){
                                finalRotation = options.rotation;
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

            if(this.debugMode) {
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
            if(objectId > -1)
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
            if(animation.object)
                mod.StopActiveMovementForObject(animation.object);
        }
        this.activeAnimations.clear();
    }

    /**
     * Animate a single numeric value from start to end with easing
     *
     * @param startValue Starting value
     * @param endValue Ending value
     * @param options Animation configuration options
     * @returns Promise that resolves when animation completes
     *
     * @example
     * // Fade in UI element
     * await animationManager.AnimateValue(0, 1, {
     *     duration: 0.5,
     *     easingFunction: Easing.EaseOutCubic,
     *     onProgress: (alpha) => {
     *         mod.SetUIElementOpacity(element, alpha);
     *     }
     * });
     *
     * @example
     * // Bounce scale animation
     * await animationManager.AnimateValue(0, 1.2, {
     *     duration: 0.8,
     *     easingFunction: Easing.EaseOutBounce,
     *     onProgress: (scale) => {
     *         mod.SetUIWidgetSize(element, mod.CreateVector(scale, scale, 0));
     *     }
     * });
     */
    async AnimateValue(
        startValue: number,
        endValue: number,
        options: ValueAnimationOptions
    ): Promise<void> {
        const easingFn = options.easingFunction || Easing.Linear;
        const tickRate = options.tickRate || 0.032;

        try {
            // Call onStart callback if provided
            if (options.onStart) {
                options.onStart();
            }

            // Create generator for eased values
            const generator = GenerateEasedValues(
                startValue,
                endValue,
                options.duration,
                easingFn,
                tickRate
            );

            // Consume generator and call onProgress for each value
            for await (const value of generator) {
                const normalizedTime = (value - startValue) / (endValue - startValue);
                options.onProgress(value, normalizedTime);
            }

            // Handle looping
            if (options.loop) {
                await this.AnimateValue(startValue, endValue, options);
                return;
            }

            // Call onComplete callback if provided
            if (options.onComplete) {
                options.onComplete();
            }
        } catch (error) {
            console.error(`[AnimateValue] Error during animation:`, error);
            throw error;
        }
    }

    /**
     * Animate multiple numeric values in parallel from start to end with easing
     * Useful for animating RGB colors, XYZ positions, or any multi-dimensional values
     *
     * @param startValues Array of starting values
     * @param endValues Array of ending values (must match length of startValues)
     * @param options Animation configuration options (onProgress receives array of values)
     * @returns Promise that resolves when animation completes
     *
     * @example
     * // Animate RGB color from red to blue
     * await animationManager.AnimateValues([255, 0, 0], [0, 0, 255], {
     *     duration: 1.0,
     *     easingFunction: Easing.EaseInOutCubic,
     *     onProgress: ([r, g, b]) => {
     *         mod.SetUIWidgetBgColor(element, mod.CreateVector(r, g, b));
     *     }
     * });
     *
     * @example
     * // Animate position and scale simultaneously
     * await animationManager.AnimateValues([0, 0, 0.5], [100, 50, 1.5], {
     *     duration: 0.8,
     *     easingFunction: Easing.EaseOutBack,
     *     onProgress: ([x, y, scale]) => {
     *         mod.SetUIElementPosition(element, mod.CreateVector(x, y, 0));
     *         mod.SetUIElementScale(element, mod.CreateVector(scale, scale, 0);
     *     }
     * });
     */
    async AnimateValues(
        startValues: number[],
        endValues: number[],
        options: Omit<ValueAnimationOptions, 'onProgress'> & {
            onProgress: (values: number[], normalizedTime: number) => void;
        }
    ): Promise<void> {
        if (startValues.length !== endValues.length) {
            console.error("AnimateValues: startValues and endValues must have the same length");
            return;
        }

        const easingFn = options.easingFunction || Easing.Linear;
        const tickRate = options.tickRate || this.tickRate;

        try {
            // Call onStart callback if provided
            if (options.onStart) {
                options.onStart();
            }

            // Create generator for eased values
            const generator = GenerateEasedValuesMulti(
                startValues,
                endValues,
                options.duration,
                easingFn,
                tickRate
            );

            // Consume generator and call onProgress for each value set
            for await (const values of generator) {
                // Calculate normalized time from first value
                const normalizedTime = (values[0] - startValues[0]) / (endValues[0] - startValues[0]);
                options.onProgress(values, normalizedTime);
            }

            // Handle looping
            if (options.loop) {
                await this.AnimateValues(startValues, endValues, options);
                return;
            }

            // Call onComplete callback if provided
            if (options.onComplete) {
                options.onComplete();
            }
        } catch (error) {
            console.error(`[AnimateValues] Error during animation:`, error);
            throw error;
        }
    }
}

//==============================================================================================
// VALUE ANIMATION GENERATORS
//==============================================================================================

/**
 * Generate eased values from start to end over a duration
 *
 * @param startValue Starting value
 * @param endValue Ending value
 * @param duration Total animation duration in seconds
 * @param easingFn Easing function to apply (default: Linear)
 * @param tickRate Time between each generated value in seconds (default: 0.032 ~30fps)
 * @returns AsyncGenerator yielding interpolated values
 *
 * @example
 * for await (const value of GenerateEasedValues(0, 100, 1.0, Easing.EaseOutCubic)) {
 *     console.log(value);
 * }
 */
async function* GenerateEasedValues(
    startValue: number,
    endValue: number,
    duration: number,
    easingFn: EasingFunction = Easing.Linear,
    tickRate: number = 0.032
): AsyncGenerator<number> {
    const totalTicks = Math.ceil(duration / tickRate);
    const valueRange = endValue - startValue;

    for (let tick = 0; tick <= totalTicks; tick++) {
        // Calculate normalized time (0 to 1)
        const normalizedTime = Math.min(tick / totalTicks, 1.0);

        // Apply easing function
        const easedTime = easingFn(normalizedTime);

        // Interpolate value
        const value = startValue + valueRange * easedTime;

        yield value;

        // Wait for next tick (except on last iteration)
        if (tick < totalTicks) {
            await mod.Wait(tickRate);
        }
    }
}

/**
 * Generate multiple eased values in parallel (useful for RGB, XYZ, etc.)
 *
 * @param startValues Array of starting values
 * @param endValues Array of ending values (must match length of startValues)
 * @param duration Total animation duration in seconds
 * @param easingFn Easing function to apply (default: Linear)
 * @param tickRate Time between each generated value in seconds (default: 0.032 ~30fps)
 * @returns AsyncGenerator yielding arrays of interpolated values
 *
 * @example
 * // Animate RGB color from red to blue
 * for await (const [r, g, b] of GenerateEasedValuesMulti([255, 0, 0], [0, 0, 255], 1.0)) {
 *     console.log(`RGB: ${r}, ${g}, ${b}`);
 * }
 */
async function* GenerateEasedValuesMulti(
    startValues: number[],
    endValues: number[],
    duration: number,
    easingFn: EasingFunction = Easing.Linear,
    tickRate: number = 0.032
): AsyncGenerator<number[]> {
    if (startValues.length !== endValues.length) {
        console.error("GenerateEasedValuesMulti: startValues and endValues must have the same length");
        return;
    }

    const totalTicks = Math.ceil(duration / tickRate);
    const valueRanges = endValues.map((end, i) => end - startValues[i]);

    for (let tick = 0; tick <= totalTicks; tick++) {
        // Calculate normalized time (0 to 1)
        const normalizedTime = Math.min(tick / totalTicks, 1.0);

        // Apply easing function
        const easedTime = easingFn(normalizedTime);

        // Interpolate all values
        const values = startValues.map((start, i) => start + valueRanges[i] * easedTime);

        yield values;

        // Wait for next tick (except on last iteration)
        if (tick < totalTicks) {
            await mod.Wait(tickRate);
        }
    }
}


//==============================================================================================
// EVENT DISPATCHER SYSTEM
//==============================================================================================
// A generic, type-safe event dispatcher for handling game events

/**
 * Event handler signature
 */
type EventHandler<T = any> = (data: T) => void;

/**
 * Generic EventDispatcher class that provides type-safe event handling
 * 
 * Usage example:
 * ```typescript
 * interface MyEventMap {
 *     'playerJoined': { player: Player };
 *     'scoreChanged': { score: number };
 * }
 * 
 * const events = new EventDispatcher<MyEventMap>();
 * events.on('playerJoined', (data) => console.log(data.player));
 * events.emit('playerJoined', { player: somePlayer });
 * ```
 */
class EventDispatcher<TEventMap = Record<string, any>> {
    private listeners: Map<string, Set<EventHandler>> = new Map();
    
    /**
     * Subscribe to an event
     * @param event - The event name to listen for
     * @param callback - The callback function to invoke when the event is emitted
     * @returns A function to unsubscribe from the event
     */
    on<K extends keyof TEventMap>(event: K, callback: EventHandler<TEventMap[K]>): () => void {
        const eventName = event as string;
        
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        
        this.listeners.get(eventName)!.add(callback);
        
        // Return unsubscribe function
        return () => this.off(event, callback);
    }
    
    /**
     * Unsubscribe from an event
     * @param event The event name to stop listening for
     * @param handler The callback function to remove
     */
    off<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
        const eventName = event as string;
        const handlers = this.listeners.get(eventName);
        
        if (handlers) {
            handlers.delete(handler);
            
            // Clean up empty sets
            if (handlers.size === 0) {
                this.listeners.delete(eventName);
            }
        }
    }
    
    /**
     * Subscribe to an event for a single execution (auto-unsubscribes after first emission)
     * @param event The event name to listen for
     * @param handler The callback function to execute once
     */
    once<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
        const onceWrapper: EventHandler<TEventMap[K]> = (data) => {
            handler(data);
            this.off(event, onceWrapper);
        };
        
        this.on(event, onceWrapper);
    }
    
    /**
     * Dispatch an event to all registered listeners
     * @param event The event name to emit
     * @param data The data to pass to event handlers
     */
    emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]): void {
        const eventName = event as string;
        const handlers = this.listeners.get(eventName);
        
        if (handlers) {
            // Create a copy of the handlers set to avoid issues if handlers modify the set
            const handlersCopy = Array.from(handlers);
            
            for (const handler of handlersCopy) {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for '${eventName}':`, error);
                }
            }
        }
    }
    
    /**
     * Check if an event has any listeners
     * @param event The event name to check
     * @returns True if the event has listeners
     */
    hasListeners<K extends keyof TEventMap>(event: K): boolean {
        const eventName = event as string;
        const handlers = this.listeners.get(eventName);
        return handlers ? handlers.size > 0 : false;
    }
    
    /**
     * Get the number of listeners for an event
     * @param event The event name to check
     * @returns The number of registered listeners
     */
    listenerCount<K extends keyof TEventMap>(event: K): number {
        const eventName = event as string;
        const handlers = this.listeners.get(eventName);
        return handlers ? handlers.size : 0;
    }
    
    /**
     * Remove all listeners for a specific event, or all events if no event is specified
     * @param event Optional event name to clear listeners for. If not provided, clears all listeners.
     */
    clear<K extends keyof TEventMap>(event?: K): void {
        if (event !== undefined) {
            const eventName = event as string;
            this.listeners.delete(eventName);
        } else {
            this.listeners.clear();
        }
    }
    
    /**
     * Get all event names that have listeners
     * @returns Array of event names
     */
    eventNames(): string[] {
        return Array.from(this.listeners.keys());
    }
}


//==============================================================================================
// CONSTANTS - Team and object IDs (you probably won't need to modify these)
//==============================================================================================

const enum TeamID {
    TEAM_NEUTRAL = 0,
    TEAM_1,
    TEAM_2,
    TEAM_3,
    TEAM_4,
    TEAM_5,
    TEAM_6,
    TEAM_7
}
const DEFAULT_TEAM_NAMES = new Map<number, string>([
    [TeamID.TEAM_NEUTRAL, mod.stringkeys.neutral_team_name],
    [TeamID.TEAM_1, mod.stringkeys.purple_team_name],
    [TeamID.TEAM_2, mod.stringkeys.orange_team_name],
    [TeamID.TEAM_3, mod.stringkeys.green_team_name],
    [TeamID.TEAM_4, mod.stringkeys.blue_team_name],
    [TeamID.TEAM_5, mod.stringkeys.red_team_name],
    [TeamID.TEAM_6, mod.stringkeys.cyan_team_name],
    [TeamID.TEAM_7, mod.stringkeys.silver_team_name]
]);

const DEFAULT_TEAM_VO_FLAGS = new Map<number, mod.VoiceOverFlags | undefined>([
    [TeamID.TEAM_NEUTRAL, undefined],
    [TeamID.TEAM_1, mod.VoiceOverFlags.Alpha],
    [TeamID.TEAM_2, mod.VoiceOverFlags.Bravo],
    [TeamID.TEAM_3, mod.VoiceOverFlags.Charlie],
    [TeamID.TEAM_4, mod.VoiceOverFlags.Delta],
    [TeamID.TEAM_5, mod.VoiceOverFlags.Echo],
    [TeamID.TEAM_6, mod.VoiceOverFlags.Foxtrot],
    [TeamID.TEAM_7, mod.VoiceOverFlags.Golf]
]);

const enum FlagIdOffsets{
    FLAG_INTERACT_ID_OFFSET = 1,
    FLAG_CAPTURE_ZONE_ID_OFFSET = 2,
    FLAG_CAPTURE_ZONE_ICON_ID_OFFSET = 3,
    FLAG_SPAWN_ID_OFFSET = 4
}

// Object IDs offsets for flag spawners and capture zones added in Godot
const TEAM_ID_START_OFFSET = 100;
const TEAM_ID_STRIDE_OFFSET = 10;


//==============================================================================================
// GLOBAL STATE
//==============================================================================================

let gameStarted = false;

// Global event dispatcher for player join/leave events
interface PlayerEventMap {
    'playerJoined': { player: mod.Player };
    'playerLeft': { playerId: number };
}
const globalPlayerEvents = new EventDispatcher<PlayerEventMap>();

// Team balance state
let lastBalanceCheckTime = 0;
let balanceInProgress = false;

// Team references
let teamNeutral: mod.Team;
let team1: mod.Team;
let team2: mod.Team;
let team3: mod.Team;
let team4: mod.Team;

// Time
let lastTickTime: number = 0;
let lastSecondUpdateTime: number = 0;

// Utility
const ZERO_VEC = mod.CreateVector(0, 0, 0);
const ONE_VEC = mod.CreateVector(1, 1, 1);

// Dynamic state management
let teams: Map<number, mod.Team> = new Map();
let teamConfigs: Map<number, TeamConfig> = new Map();
let teamScores: Map<number, number> = new Map();
let flags: Map<number, Flag> = new Map();
let captureZones: Map<number, CaptureZone> = new Map();

// Global managers
let worldIconManager: WorldIconManager;
let vfxManager: VFXManager;
let animationManager: AnimationManager;


//==============================================================================================
// UI HIERARCHY INITIALIZATION
//==============================================================================================

/**
 * Position a team HUD below the global HUD
 * @param teamId The team ID to position the HUD for
 */
function PositionTeamHUD(teamId: number): void {
    // Get global HUD position and size
    let globalHUD = GlobalScoreboardHUD.getInstance().getHUD();
    if (!globalHUD?.rootWidget) return;

    let globalHUDPos = mod.GetUIWidgetPosition(globalHUD.rootWidget);
    let globalHUDSize = mod.GetUIWidgetSize(globalHUD.rootWidget);

    // Get team HUD instance
    let teamHUD = TeamScoreboardHUD.getInstance(teamId);
    if (!teamHUD?.rootWidget) return;

    // Calculate offset position below global HUD
    let teamHUDPos = mod.GetUIWidgetPosition(teamHUD.rootWidget);
    let offsetBarY = mod.YComponentOf(globalHUDPos) + mod.YComponentOf(globalHUDSize) + 10;

    // Apply position
    mod.SetUIWidgetPosition(
        teamHUD.rootWidget,
        mod.CreateVector(mod.XComponentOf(teamHUDPos), offsetBarY, 0)
    );

    if (DEBUG_MODE) {
        console.log(`Positioned team ${teamId} HUD at Y offset: ${offsetBarY}`);
    }
}

/**
 * Initialize the three-tier UI hierarchy:
 * 1. Global HUD (visible to all players)
 * 2. Team HUDs (visible to players on each team)
 * 3. Player HUDs (visible only to specific player) - created in JSPlayer.initUI()
 */
function InitializeUIHierarchy(): void {
    // 1. Create Global HUD (one instance for the entire game)
    const globalHUD = GlobalScoreboardHUD.getInstance();   
    if (currentHUDClass) {
        globalHUD.createGlobalHUD(currentHUDClass);
        if (DEBUG_MODE) {
            console.log(`InitializeUIHierarchy: Created global HUD with ${currentHUDClass.name}`);
        }
    }

    // 2. Create Team HUDs (one per team, not including neutral team)
    for (const [teamId, team] of teams.entries()) {
        if (teamId === 0) continue; // Skip neutral team

        TeamScoreboardHUD.create(team);
        PositionTeamHUD(teamId);

        if (DEBUG_MODE) {
            console.log(`InitializeUIHierarchy: Created team HUD for team ${teamId}`);
        }
    }

    // 3. Player HUDs are created individually in JSPlayer.initUI() when players spawn
    if (DEBUG_MODE) {
        console.log(`InitializeUIHierarchy: UI hierarchy initialized (Global + ${teams.size - 1} team HUDs)`);
    }
}

//==============================================================================================
// MAIN GAME LOOP
//==============================================================================================

export async function OnGameModeStarted() {
    console.log(`CTF Game Mode v${VERSION[0]}.${VERSION[1]}.${VERSION[2]} Started`);
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.version_author));
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.version_started, VERSION[0], VERSION[1], VERSION[2]));

    // Initialize global managers
    worldIconManager = WorldIconManager.getInstance();
    vfxManager = VFXManager.getInstance();
    animationManager = new AnimationManager(DEBUG_MODE, TICK_RATE, ZERO_VEC);

    // Initialize legacy team references (still needed for backwards compatibility)
    teamNeutral = mod.GetTeam(TeamID.TEAM_NEUTRAL);
    team1 = mod.GetTeam(TeamID.TEAM_1);
    team2 = mod.GetTeam(TeamID.TEAM_2);
    team3 = mod.GetTeam(TeamID.TEAM_3);
    team4 = mod.GetTeam(TeamID.TEAM_4);

    await mod.Wait(1);

    // Load game mode configuration
    // let config = FourTeamCTFConfig;
    // LoadGameModeConfig(config);
    let gameModeID = -1;
    let activeConfig: GameModeConfig | undefined = undefined;
    for(let [configID, config] of DEFAULT_GAMEMODES){
        let gameModeConfigObj = mod.GetSpatialObject(configID);
        let gameModeExistsFallbackPos = mod.GetObjectPosition(gameModeConfigObj);
        // Make sure the gameconfig object actually exists.
        // If the game mode config object has a zero vector, it doesn't exist
        let isAtOrigin = AreVectorsEqual(gameModeExistsFallbackPos, ZERO_VEC, 0.1);
        if(DEBUG_MODE)
            console.log(`currentModeId: ${configID}, gameModeConfigObj: ${gameModeConfigObj}, is at origin: ${isAtOrigin}, position: ${VectorToString(gameModeExistsFallbackPos)}`);
        
        if(gameModeConfigObj && !isAtOrigin){
            // Look up config from the map
            gameModeID = configID;
            activeConfig = config
            if(gameModeID > -1){
                console.log(`Found game mode with id ${configID}`);
                mod.SendErrorReport(mod.Message(mod.stringkeys.found_gamemode_id, gameModeID));
            }
            break;
        }
    }
    
    if(activeConfig){
        mod.SendErrorReport(mod.Message(mod.stringkeys.loading_gamemode_id, gameModeID));
        LoadGameModeConfig(activeConfig);
    } else {
        LoadGameModeConfig(ClassicCTFConfig);
        console.log("Could not find a gamemode. Falling back to classic 2-team CTF");
        return;
    }

    // Set up initial player scores using JSPlayer
    let players = mod.AllPlayers();
    let numPlayers = mod.CountOf(players);
    for (let i = 0; i < numPlayers; i++) {
        let loopPlayer = mod.ValueInArray(players, i);
        if(mod.IsPlayerValid(loopPlayer)){
            JSPlayer.get(loopPlayer); // Create JSPlayer instance
        }
    }

    // Start game
    gameStarted = true;

    // Initialize UI hierarchy based on scope
    InitializeUIHierarchy();

    // Start update loops
    TickUpdate();
    SecondUpdate();

    if(DEBUG_MODE){
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_initialized));
        console.log("CTF: Game initialized and started");
    }


    RefreshScoreboard();
}

async function TickUpdate(): Promise<void> {
    while (gameStarted) {
        await mod.Wait(TICK_RATE);

        let currentTime = GetCurrentTime();
        let timeDelta = currentTime - lastTickTime;
        // console.log(`Fast tick delta ${timeDelta}`);

        // Update all flag carrier positions
        for (const [flagId, flag] of flags.entries()) {
            flag.FastUpdate(timeDelta);
        }

        // Refresh UI hierarchy:
        // 1. Global HUD (scores, timer, flags)
        GlobalScoreboardHUD.getInstance().refresh();

        // 2. Team HUDs (team orders) - refresh on events, not in tick loop

        // 3. Player HUDs (player-specific team orders)
        JSPlayer.getAllAsArray().forEach(jsPlayer => {
            jsPlayer.scoreboardUI?.refresh();
        });

        lastTickTime = currentTime;
    }
}

async function SecondUpdate(): Promise<void> {
    while (gameStarted) {
        await mod.Wait(1);

        let currentTime = GetCurrentTime();
        let timeDelta = currentTime - lastTickTime;        
        
        // Periodic team balance check
        if (TEAM_AUTO_BALANCE) {
            CheckAndBalanceTeams();
        }

        // Periodically update scoreboard for players
        RefreshScoreboard();

        // Check time limit
        if (mod.GetMatchTimeRemaining() <= 0) {
            EndGameByTime();
        }

        // Slow update for flags
        for(let [flagID, flag] of flags){
            flag.SlowUpdate(timeDelta);
        }

        // Verify player is not driving
        // Fix for some vehicles not trigger events
        if(VEHICLE_BLOCK_CARRIER_DRIVING){
            JSPlayer.getAllAsArray().forEach((jsPlayer: JSPlayer) => {
                if(jsPlayer.player) {  
                    if (IsCarryingAnyFlag(jsPlayer.player)) {      
                        if(mod.GetSoldierState(jsPlayer.player, mod.SoldierStateBool.IsInVehicle)){
                            if (mod.GetPlayerVehicleSeat(jsPlayer.player) === VEHICLE_DRIVER_SEAT) {
                                if (DEBUG_MODE) console.log("Flag carrier in driver seat, forcing to passenger");
                                ForceToPassengerSeat(jsPlayer.player, mod.GetVehicleFromPlayer(jsPlayer.player));
                            }
                        }
                    }
                }
            });
        }

        lastSecondUpdateTime = currentTime;
    }
}


//==============================================================================================
// EVENT HANDLERS
//==============================================================================================

async function FixTeamScopedUIVisibility(player: mod.Player): Promise<void> {
    // WORKAROUND: Fix for team-scoped UI visibility bug
    // Tear down and rebuild the team UI for the player's team
    // This ensures team-scoped UIs become visible to the newly joined player

    const playerTeam = mod.GetTeam(player);
    const playerTeamId = mod.GetObjId(playerTeam);

    // Skip neutral team
    if (playerTeamId === 0) return;

    if (DEBUG_MODE) {
        console.log(`Rebuilding team UI for team ${playerTeamId} (player ${mod.GetObjId(player)} joined)`);
    }

    // Step 1: Destroy the existing team UI
    const existingHUD = TeamScoreboardHUD.getInstance(playerTeamId);
    if (existingHUD) {
        existingHUD.close();
    }

    // Step 2: Wait a frame for cleanup to complete
    //await mod.Wait(0);

    // Step 3: Recreate the team UI
    TeamScoreboardHUD.create(playerTeam);

    // Step 4: Reposition using shared function
    PositionTeamHUD(playerTeamId);

    if (DEBUG_MODE) {
        console.log(`Team UI rebuilt successfully for team ${playerTeamId}`);
    }
}

export function OnPlayerJoinGame(eventPlayer: mod.Player): void {
    if (DEBUG_MODE) {
        console.log(`Player joined: ${mod.GetObjId(eventPlayer)}`);
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_joined, mod.GetObjId(eventPlayer)));
    }

    // Emit player joined event (for any other handlers that need it)
    globalPlayerEvents.emit('playerJoined', { player: eventPlayer });

    // Note: WorldIcon refresh and UI visibility fix now happens on first deploy, not on join
    // This prevents icons from disappearing when refreshed before player deploys

    // Refresh scoreboard to update new player team entry and score
    RefreshScoreboard();
}

export function OnPlayerLeaveGame(playerId: number): void {
    // Check if leaving player was carrying any flag
    for (const [flagId, flagData] of flags.entries()) {
        if (flagData.carrierPlayer && mod.GetObjId(flagData.carrierPlayer) === playerId) {
            // Drop each flag at its current position
            flagData.DropFlag(flagData.currentPosition);
        }
    }
    
    if (DEBUG_MODE) {
        console.log(`Player left: ${playerId}`);
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_left, playerId));
    }

    // Remove JSPlayer instance
    JSPlayer.removeInvalidJSPlayers(playerId);
}

export function OnPlayerDeployed(eventPlayer: mod.Player): void {
    // Players spawn at their team's HQ
    if (DEBUG_MODE) {
        const teamId = mod.GetObjId(mod.GetTeam(eventPlayer));
        // console.log(`Player ${mod.GetObjId(eventPlayer)} deployed on team ${teamId}`);
    }

    // If we don't have a JSPlayer by now, we really should create one
    let jsPlayer = JSPlayer.get(eventPlayer);

    // Check if this is the player's first deployment
    if (jsPlayer && !jsPlayer.hasEverDeployed) {
        jsPlayer.hasEverDeployed = true;

        if (DEBUG_MODE) {
            console.log(`Player ${mod.GetObjId(eventPlayer)} deployed for the first time - refreshing WorldIcons, VFX, and UI`);
        }

        // Refresh WorldIcons to fix visibility for this player
        // Small delay to ensure player is fully initialized before refreshing
        mod.Wait(0.1).then(() => {
            worldIconManager.refreshAllIcons();
        });

        // Refresh all VFX to fix visibility for this player
        vfxManager.refreshAllVFX();

        // Fix team-scoped UI visibility
        FixTeamScopedUIVisibility(eventPlayer);
    }

    // Set up the player UI on spawn
    jsPlayer?.initUI();

    for(let [captureZoneId, captureZone] of captureZones){
        captureZone.UpdateIcons();
    }
}

export function OnPlayerDied(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDeathType: mod.DeathType,
    eventWeaponUnlock: mod.WeaponUnlock
): void {
    // If player was carrying a flag, drop it
    if(DEBUG_MODE)
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_died, eventPlayer));
    
    // Increment flag carrier kill score
    let killer = JSPlayer.get(eventOtherPlayer);
    if(killer){
        if(IsCarryingAnyFlag(eventPlayer) || WasCarryingAnyFlag(eventPlayer))
            killer.score.flag_carrier_kills += 1;
        else
            killer.score.kills += 1; 
    }

    // Drop all flags on death
    DropAllFlags(eventPlayer);
}

export function OnPlayerInteract(
    eventPlayer: mod.Player, 
    eventInteractPoint: mod.InteractPoint
): void {
    const interactId = mod.GetObjId(eventInteractPoint);
    const playerTeamId = mod.GetObjId(mod.GetTeam(eventPlayer));

    // Check all flags dynamically for interactions
    for(let flag of flags){
        let flagData = flag[1];
        // Check if we're interacting with this flag
        if(flagData.flagInteractionPoint){
            if(interactId == mod.GetObjId(flagData.flagInteractionPoint)){
                HandleFlagInteraction(eventPlayer, playerTeamId, flagData);
                return;
            }
        }
    }
}

export function OnPlayerEnterAreaTrigger(
    eventPlayer: mod.Player, 
    eventAreaTrigger: mod.AreaTrigger
): void {
    const triggerId = mod.GetObjId(eventAreaTrigger);
    const playerTeamId = mod.GetObjId(mod.GetTeam(eventPlayer));
    
    if (DEBUG_MODE) {
        // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.on_capture_zone_entered, eventPlayer, playerTeamId, triggerId))
        console.log(`Player ${mod.GetObjId(eventPlayer)} entered area trigger ${triggerId}`);
    }
    
    for(const [teamId, captureZone] of captureZones.entries()){
        console.log(`Checking if we entered capture zone ${captureZone.captureZoneID} area trigger for team ${teamId}`);
        if(captureZone.areaTrigger){
            if(triggerId === mod.GetObjId(captureZone.areaTrigger)){
                console.log(`Entered capture zone ${captureZone.captureZoneID} area trigger for team ${teamId}`);
                captureZone.HandleCaptureZoneEntry(eventPlayer);
            }
        }
    }
}

export function OnPlayerExitAreaTrigger(
    eventPlayer: mod.Player, 
    eventAreaTrigger: mod.AreaTrigger
): void {
    const triggerId = mod.GetObjId(eventAreaTrigger);
    
    if (DEBUG_MODE) {
        console.log(`Player ${mod.GetObjId(eventPlayer)} exited area trigger ${triggerId}`);
        // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_exit_trigger, eventPlayer, mod.GetObjId(eventAreaTrigger)))
    }
}

export function OnPlayerEnterVehicle(
    eventPlayer: mod.Player,
    eventVehicle: mod.Vehicle
): void {
    if(DEBUG_MODE)
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.debug_player_enter_vehicle));

    // Check if player is carrying a flag
    if (IsCarryingAnyFlag(eventPlayer) && VEHICLE_BLOCK_CARRIER_DRIVING) {
        if (DEBUG_MODE) {
            console.log("Flag carrier entered vehicle");
        }
        ForceToPassengerSeat(eventPlayer, eventVehicle);
    }
}

export function OnPlayerEnterVehicleSeat(
    eventPlayer: mod.Player,
    eventVehicle: mod.Vehicle,
    eventSeat: mod.Object
): void {
    // If player is carrying flag and in driver seat, force to passenger
    if (IsCarryingAnyFlag(eventPlayer) && VEHICLE_BLOCK_CARRIER_DRIVING) {      
        if(eventPlayer) {  
            if (mod.GetPlayerVehicleSeat(eventPlayer) === VEHICLE_DRIVER_SEAT) {
                if (DEBUG_MODE) console.log("Flag carrier in driver seat, forcing to passenger");
                ForceToPassengerSeat(eventPlayer, eventVehicle);
            }
        }
    }
}

export function OnGameModeEnding(): void {
    gameStarted = false;
    console.log("CTF: Game ending");
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.round_ending))
}


//==============================================================================================
// GAME LOGIC FUNCTIONS
//==============================================================================================

async function ForceToPassengerSeat(player: mod.Player, vehicle: mod.Vehicle): Promise<void> {
    // Try to find an empty passenger seat
    const seatCount = mod.GetVehicleSeatCount(vehicle);
    let forcedToSeat = false;
    let lastSeat = seatCount - 1;
    let delayBeforeSwitch = TICK_RATE * 2;
    for (let i = seatCount-1; i >= VEHICLE_FIRST_PASSENGER_SEAT; --i) {
        if (!mod.IsVehicleSeatOccupied(vehicle, i)) {
            // Make sure we're not still in the OnPlayerEnteredVehicle event
            await mod.Wait(delayBeforeSwitch);

            mod.ForcePlayerToSeat(player, vehicle, i);
            forcedToSeat = true;
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.forced_to_seat), player);
            if (DEBUG_MODE) console.log(`Forced flag carrier to seat ${i}`);
            return;
        }
    }
    
    // Try last seat as fallback
    if (!mod.IsVehicleSeatOccupied(vehicle, lastSeat)) {
        // Make sure we're not still in the OnPlayerEnteredVehicle event
        await mod.Wait(delayBeforeSwitch);

        mod.ForcePlayerToSeat(player, vehicle, lastSeat);
        forcedToSeat = true;
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.forced_to_seat), player);
        if (DEBUG_MODE) console.log(`Forced flag carrier to seat ${lastSeat}`);
        return;
    }
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.no_passenger_seats, player));

    // Make sure we're not still in the OnPlayerEnteredVehicle event
    await mod.Wait(delayBeforeSwitch);
    
    // No passenger seats available, force exit
    mod.ForcePlayerExitVehicle(player, vehicle);
    if (DEBUG_MODE) console.log("No passenger seats available, forcing exit");
}



//==============================================================================================
// UTILITY FUNCTIONS
//==============================================================================================

function GetCurrentTime(): number {
    //return mod.GetMatchTimeElapsed();
    return Date.now() / 1000;
}

function GetRandomInt(max: number): number {
    return Math.floor(Math.random() * max);
}

function GetTeamName(team: mod.Team): string {
    let teamName = teamConfigs.get(mod.GetObjId(team))?.name;
    if(teamName){
        return teamName;
    }

    let teamId = mod.GetObjId(team);
    return DEFAULT_TEAM_NAMES.get(teamId) ?? mod.stringkeys.neutral_team_name;
}

// New multi-team helper functions
function GetOpposingTeams(teamId: number): number[] {
    const opposing: number[] = [];
    for (const [id, team] of teams.entries()) {
        if (id !== teamId && id !== 0) { // Exclude self and neutral
            opposing.push(id);
        }
    }
    return opposing;
}

function GetTeamColorById(teamId: number): mod.Vector {
    // Check if we have a config for this team
    const config = teamConfigs.get(teamId);
    if (config?.color) {
        return config.color;
    }

    return DEFAULT_TEAM_COLOURS.get(teamId) ?? NEUTRAL_COLOR;
}

function GetTeamColor(team: mod.Team): mod.Vector {
    return GetTeamColorById(mod.GetObjId(team));
}

function GetTeamDroppedColor(team: mod.Team): mod.Vector {
    return GetTeamColorById(mod.GetObjId(team) );
}

function GetTeamColorLight(team: mod.Team): mod.Vector {
    return VectorClampToRange(mod.Add(GetTeamColor(team), mod.CreateVector(0.65, 0.65, 0.65)), 0, 1);
}

function GetTeamColorDark(team: mod.Team): mod.Vector {
    return VectorClampToRange(mod.Multiply(GetTeamColor(team), 0.8), 0, 1);
}

export function GetPlayersInTeam(team: mod.Team) {
    const allPlayers = mod.AllPlayers();
    const n = mod.CountOf(allPlayers);
    let teamMembers = [];

    for (let i = 0; i < n; i++) {
        let player = mod.ValueInArray(allPlayers, i) as mod.Player;
        if (mod.GetObjId(mod.GetTeam(player)) == mod.GetObjId(team)) {
            teamMembers.push(player);
        }
    }
    return teamMembers;
}


//==============================================================================================
// JSPLAYER CLASS
//==============================================================================================

class PlayerScore {
    captures: number
    capture_assists: number
    flag_carrier_kills: number
    kills: number;

    constructor(captures: number = 0, capture_assists: number = 0, flag_carrier_kills:number = 0, kills = 0){
        this.captures = captures;
        this.capture_assists = capture_assists
        this.flag_carrier_kills = flag_carrier_kills
        this.kills = kills;
    }
}

class JSPlayer {
    // Player game attributes
    readonly player: mod.Player;
    readonly playerId: number;
    score: PlayerScore;
    readonly joinOrder: number; // Track join order for team balancing
    heldFlags: Flag[] = [];
    hasEverDeployed: boolean = false; // Track if player has deployed at least once

    // Player world attributes
    lastPosition: mod.Vector = ZERO_VEC;
    velocity: mod.Vector = ZERO_VEC;

    // UI
    scoreboardUI?: BaseScoreboardHUD;

    static playerInstances: mod.Player[] = [];
    static #allJsPlayers: { [key: number]: JSPlayer } = {};
    static #nextJoinOrder: number = 0; // Counter for join order

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        this.score = new PlayerScore();
        this.joinOrder = JSPlayer.#nextJoinOrder++;
        JSPlayer.playerInstances.push(this.player);
        
        if (DEBUG_MODE) {
            console.log(`CTF: Adding Player [${this.playerId}] with join order ${this.joinOrder}. Total: ${JSPlayer.playerInstances.length}`);
        }
    }

    initUI(): void {
        // Create PLAYER-SCOPED scoreboard UI for human players
        // Global and team-scoped UIs are created in InitializeUIHierarchy()
        if(!this.scoreboardUI){
            if (!mod.GetSoldierState(this.player, mod.SoldierStateBool.IsAISoldier)) {
                // Create player-specific HUD (TeamOrdersBar)
                this.scoreboardUI = new PlayerScoreboardHUD(this.player);
            }
        }
    }

    resetUI(): void {
        delete this.scoreboardUI;
        this.initUI();
    }

    static get(player: mod.Player): JSPlayer | undefined {
        if (!gameStarted && mod.GetObjId(player) > -1) {
            return undefined;
        }
        
        if (mod.GetObjId(player) > -1) {
            let index = mod.GetObjId(player);
            let jsPlayer = this.#allJsPlayers[index];
            if (!jsPlayer) {
                jsPlayer = new JSPlayer(player);
                this.#allJsPlayers[index] = jsPlayer;
            }
            return jsPlayer;
        }
        return undefined;
    }

    static removeInvalidJSPlayers(invalidPlayerId: number): void {
        if (!gameStarted) return;
        
        if (DEBUG_MODE) {
            console.log(`Removing Invalid JSPlayer. Currently: ${JSPlayer.playerInstances.length}`);
        }
        
        // Remove from allJsPlayers
        delete this.#allJsPlayers[invalidPlayerId];
        
        // Remove from playerInstances array
        let indexToRemove = -1;
        for (let i = 0; i < JSPlayer.playerInstances.length; i++) {
            if (mod.GetObjId(JSPlayer.playerInstances[i]) === invalidPlayerId) {
                indexToRemove = i;
                break;
            }
        }
        
        if (indexToRemove > -1) {
            JSPlayer.playerInstances.splice(indexToRemove, 1);
        }
        
        if (DEBUG_MODE) {
            console.log(`Player [${invalidPlayerId}] removed. JSPlayers Remaining: ${JSPlayer.playerInstances.length}`);
        }
    }

    static getAllAsArray(): JSPlayer[] {
        return Object.values(this.#allJsPlayers);
    }
}


//==============================================================================================
// SCORING AND RULES
//==============================================================================================


function RefreshScoreboard(){
    for(let jsPlayer of JSPlayer.getAllAsArray()){
        UpdatePlayerScoreboard(jsPlayer.player);
    }
}

function UpdatePlayerScoreboard(player: mod.Player){
    let jsPlayer = JSPlayer.get(player);
    let teamId = modlib.getTeamId(mod.GetTeam(player));
    if(jsPlayer){
        if(teams.size >= 3){
            mod.SetScoreboardPlayerValues(player, teamId, jsPlayer.score.captures, jsPlayer.score.capture_assists, jsPlayer.score.flag_carrier_kills);
        } else {
            mod.SetScoreboardPlayerValues(player, jsPlayer.score.captures, jsPlayer.score.capture_assists, jsPlayer.score.flag_carrier_kills);
        }
    }
}

function GetLeadingTeamIDs(): number[]{
    let leadingTeams: number[] = [];
    let maxScore = 0;
    for (const [teamId, score] of teamScores.entries()) {
        if (score > maxScore) {
            maxScore = score;
            leadingTeams = [teamId];
        } else if (score === maxScore && score > 0) {
            leadingTeams.push(teamId);
        }
    }

    return leadingTeams;
}

function ScoreCapture(scoringPlayer: mod.Player, capturedFlag: Flag, scoringTeam: mod.Team): void {
    // Set player score using JSPlayer
    let jsPlayer = JSPlayer.get(scoringPlayer);
    if (jsPlayer) {
        jsPlayer.score.captures += 1;
        UpdatePlayerScoreboard(scoringPlayer);
        
        if (DEBUG_MODE) {
            mod.DisplayHighlightedWorldLogMessage(mod.Message(
                mod.stringkeys.player_score, 
                jsPlayer.score.captures, 
                jsPlayer.score.capture_assists));
        }
    }

    // Increment team score in dynamic scores map
    let scoringTeamId = mod.GetObjId(scoringTeam);
    let currentScore = teamScores.get(scoringTeamId) ?? 0;
    currentScore++;
    teamScores.set(scoringTeamId, currentScore);
    
    // Update game mode score
    mod.SetGameModeScore(scoringTeam, currentScore);
    
    // Notify players
    if (DEBUG_MODE) {
        console.log(`Team ${scoringTeamId} scored! New score: ${currentScore}`);
    }

    // Play VFX at scoring team's flag base
    const scoringTeamFlag = flags.get(scoringTeamId);
    if (scoringTeamFlag) {
        CaptureFeedback(capturedFlag.currentPosition);

        // Play SFX
        // Play pickup SFX
        let captureSfxOwner: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_EnemyCapturedCache_OneShot2D, scoringTeamFlag.homePosition, ZERO_VEC);
        mod.PlaySound(captureSfxOwner, 1, scoringTeamFlag.team);
        let captureSfxCapturer: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_FriendlyCapturedCache_OneShot2D, scoringTeamFlag.homePosition, ZERO_VEC);
        mod.PlaySound(captureSfxCapturer, 1, mod.GetTeam(scoringTeamId)); 
        
        // Play audio
        let capturingTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, scoringTeamFlag.homePosition, ZERO_VEC);
        if(capturingTeamVO){
            let vo_flag = DEFAULT_TEAM_VO_FLAGS.get(capturedFlag.teamId);
            mod.PlayVO(capturingTeamVO, mod.VoiceOverEvents2D.ObjectiveCaptured, vo_flag ?? mod.VoiceOverFlags.Alpha, scoringTeam);
        }
    }

    // Return all captured flags to their home spawners
    GetCarriedFlags(scoringPlayer).forEach((flag:Flag) => {
        flag.events.emit("flagCaptured", {flag: flag, player: scoringPlayer});
        flag.ResetFlag();
    });
    // Check win condition
    if (currentScore >= GAMEMODE_TARGET_SCORE) {
        EndGameByScore(scoringTeamId);
    }
}

function EndGameByScore(winningTeamId: number): void {
    gameStarted = false;
    
    const winningTeam = mod.GetTeam(winningTeamId);
    const teamName = winningTeamId === 1 ? "Blue" : "Red";
    
    console.log(`Game ended - Team ${winningTeamId} wins by score`);
    if(DEBUG_MODE)
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.game_ended_score, winningTeamId))
    mod.EndGameMode(winningTeam);    
}

function EndGameByTime(): void {
    gameStarted = false;
    if(DEBUG_MODE)
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.game_ended_time));
    console.log(`Game ended by time limit`);
    
    // Determine winner by score
    // if (team1Score > team2Score) {
    //     mod.EndGameMode(team1);
    // } else if (team2Score > team1Score) {
    //     mod.EndGameMode(team2);
    // } else {
    //     mod.EndGameMode(mod.GetTeam(0)); // Draw
    // }
}

async function CaptureFeedback(pos: mod.Vector): Promise<void> {
    let vfx: mod.VFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Vehicle_Car_Destruction_Death_Explosion_PTV, pos, ZERO_VEC);
    let sfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Standoff_ZoneCaptured_OneShot2D, pos, ZERO_VEC);
    mod.PlaySound(sfx, 1.5);

    // Wait for a second so we can hear the stinger
    await mod.Wait(1.1);
    mod.EnableVFX(vfx, true);

    // Cleanup
    await mod.Wait(5);
    mod.UnspawnObject(sfx);
    mod.UnspawnObject(vfx);
}


//==============================================================================================
// FLAG CLASS
//==============================================================================================

/**
 * Flag-specific event map defining all possible flag events and their data
 */
interface FlagEventMap {
    /** Emitted when a flag is picked up by a player */
    'flagTaken': { 
        flag: Flag; 
        player: mod.Player;
        isAtHome: boolean;  // Was the flag taken from home or picked up after being dropped?
    };
    
    /** Emitted when a flag is dropped by a player */
    'flagDropped': { 
        flag: Flag; 
        position: mod.Vector;
        previousCarrier: mod.Player | null;
    };
    
    /** Emitted when a flag is returned to its home position */
    'flagReturned': { 
        flag: Flag;
        player: mod.Player | undefined    // Player that returned the flag. Null if auto returned
    };
    
    /** Emitted when a flag reaches its home position (same as return, but separate for clarity) */
    'flagAtHome': { 
        flag: Flag;
    };
    
    /** Emitted when a flag's state changes in any way */
    'flagStateChanged': {
        flag: Flag;
        isAtHome: boolean;
        isBeingCarried: boolean;
        isDropped: boolean;
    };
    'flagCaptured': {
        flag: Flag;
        player: mod.Player;
    };
}


class Flag {
    readonly flagId: number;
    readonly owningTeamId: number;
    readonly allowedCapturingTeams: number[];
    customColor?: mod.Vector;
    
    readonly team: mod.Team;
    readonly teamId: number;
    readonly homePosition: mod.Vector;

    // Flag position
    currentPosition: mod.Vector;
    followPoints: mod.Vector[];
    followDelay: number;   // Number of points to cache for flag to follow
    
    // Smoothed values for exponential averaging
    smoothedPosition: mod.Vector;
    smoothedRotation: mod.Vector;
    
    // State
    isAtHome: boolean = true;
    isBeingCarried: boolean = false;
    isDropped: boolean = false;
    canBePickedUp: boolean = true;
    numFlagTimesPickedUp:number = 0;
    
    // Player tracking
    carrierPlayer: mod.Player | null = null;
    lastCarrier: mod.Player | null = null;
    
    // Timers
    dropTime: number = 0;
    autoReturnTime: number = 0;
    
    // Game objects
    flagRecoverIcon: mod.WorldIcon;
    flagCarriedIcons: Map<number, mod.WorldIcon> = new Map(); // One icon per opposing team
    flagInteractionPoint: mod.InteractPoint | null = null;
    flagProp: mod.Object | null = null;

    // WorldIcon manager IDs for tracking
    recoverIconId: string = '';
    carriedIconIds: Map<number, string> = new Map();

    // VFX
    flagSmokeVFX: mod.VFX;
    tetherFlagVFX: mod.VFX | null = null;
    tetherPlayerVFX: mod.VFX | null = null;
    hoverVFX: mod.VFX | null = null;
    pickupChargingVFX: mod.VFX | null = null;
    pickupAvailableVFX: mod.VFX | null = null;
    flagImpactVFX: mod.VFX | null = null;
    flagSparksVFX: mod.VFX | null = null;

    // VFX manager IDs for tracking
    smokeVFXId: string = '';
    sparksVFXId: string = '';
    impactVFXId: string = '';

    // SFX
    alarmSFX : mod.SFX | null = null;
    dragSFX: mod.SFX | null = null;
    pickupTimerStartSFX:mod.SFX | null = null;
    pickupTimerRiseSFX:mod.SFX | null = null;
    pickupTimerStopSFX:mod.SFX | null = null;

    // Event system
    readonly events: EventDispatcher<FlagEventMap>;
    
    constructor(
        team: mod.Team, 
        homePosition: mod.Vector,
        flagId?: number,
        allowedCapturingTeams?: number[],
        customColor?: mod.Vector
    ) {
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.owningTeamId = this.teamId;
        this.flagId = flagId ?? this.teamId; // Default to team ID for backwards compatibility
        this.allowedCapturingTeams = allowedCapturingTeams ?? []; // Empty = all opposing teams
        this.customColor = customColor;
        this.homePosition = homePosition;
        this.currentPosition = homePosition;
        this.smoothedPosition = homePosition;
        this.smoothedRotation = ZERO_VEC;
        this.followPoints = [];
        this.followDelay = 10;
        this.flagInteractionPoint = null;
        this.flagRecoverIcon = null as any; // Will be created in Initialize()
        this.flagProp = null;
        this.flagSmokeVFX = null as any; // Will be created in Initialize()
        this.dragSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Levels_Brooklyn_Shared_Spots_MetalStress_OneShot3D, this.homePosition, ZERO_VEC);
        this.hoverVFX = null; //mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Missile_Javelin, this.homePosition, ZERO_VEC);
        this.pickupChargingVFX = null; //mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Gadget_InterativeSpectator_Camera_Light_Red, this.homePosition, ZERO_VEC);
        this.pickupAvailableVFX = null; //mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Gadget_InterativeSpectator_Camera_Light_Green, this.homePosition, ZERO_VEC);
        this.flagImpactVFX = null as any; // Will be created in Initialize()
        this.flagSparksVFX = null as any; // Will be created in Initialize()

        this.pickupTimerStartSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_AltRecoveringCacheStart_OneShot2D, this.homePosition, ZERO_VEC);
        this.pickupTimerRiseSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_AltRecoveringCacheTimer_OneShot2D, this.homePosition, ZERO_VEC);
        this.pickupTimerStopSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_AltRecoveringCacheStop_OneShot2D, this.homePosition, ZERO_VEC);
        
        // Initialize event system
        this.events = new EventDispatcher<FlagEventMap>();

        this.Initialize();
    }

    Initialize(): void {
        // Register WorldIcons with WorldIconManager
        const iconMgr = worldIconManager;

        // Create recover icon (shown to flag's team)
        this.recoverIconId = `flag_${this.flagId}_recover`;
        this.flagRecoverIcon = iconMgr.createIcon(
            this.recoverIconId,
            ZERO_VEC,
            {
                icon: mod.WorldIconImages.Flag,
                iconEnabled: false,
                textEnabled: false,
                color: this.GetFlagColor(),
                teamOwner: this.team
            }
        );

        // Create one carried icon per opposing team
        const opposingTeams = GetOpposingTeamsForFlag(this);
        for (const opposingTeamId of opposingTeams) {
            const opposingTeam = teams.get(opposingTeamId);
            if (opposingTeam) {
                const carriedIconId = `flag_${this.flagId}_carried_team${opposingTeamId}`;
                const carriedIcon = iconMgr.createIcon(
                    carriedIconId,
                    ZERO_VEC,
                    {
                        icon: mod.WorldIconImages.Flag,
                        iconEnabled: false,
                        textEnabled: false,
                        color: this.GetFlagColor(),
                        teamOwner: opposingTeam
                    }
                );
                this.flagCarriedIcons.set(opposingTeamId, carriedIcon);
                this.carriedIconIds.set(opposingTeamId, carriedIconId);
            }
        }

        // Register VFX with VFXManager
        const vfxMgr = vfxManager;

        // Create flag smoke VFX (main visual indicator)
        this.smokeVFXId = `flag_${this.flagId}_smoke`;
        this.flagSmokeVFX = vfxMgr.createVFX(
            this.smokeVFXId,
            mod.RuntimeSpawn_Common.FX_Smoke_Marker_Custom,
            this.homePosition,
            ZERO_VEC,
            {
                color: this.GetFlagColor(),
                enabled: true
            }
        );

        // Create flag sparks VFX (pickup ready indicator)
        this.sparksVFXId = `flag_${this.flagId}_sparks`;
        this.flagSparksVFX = vfxMgr.createVFX(
            this.sparksVFXId,
            mod.RuntimeSpawn_Common.FX_BASE_Sparks_Pulse_L,
            this.homePosition,
            ZERO_VEC,
            {
                enabled: false // Disabled until flag is ready to pickup
            }
        );

        // Create flag impact VFX (drop impact effect)
        this.impactVFXId = `flag_${this.flagId}_impact`;
        this.flagImpactVFX = vfxMgr.createVFX(
            this.impactVFXId,
            mod.RuntimeSpawn_Common.FX_Impact_LootCrate_Generic,
            this.homePosition,
            ZERO_VEC,
            {
                enabled: false // Only enabled briefly on drop
            }
        );

        // Note: VFX are now refreshed on first player deploy using VFXManager
        // This is handled by vfxManager.refreshAllVFX() in OnPlayerDeployed

        // Set up flag at home position
        this.SpawnFlagAtHome();

        if (DEBUG_MODE) {
            console.log(`Flag initialized for team ${this.teamId} at position: ${VectorToString(this.homePosition)}`);
        }
    }

    SpawnFlagAtHome(): void {
        this.isAtHome = true;
        this.isBeingCarried = false;
        this.isDropped = false;
        this.canBePickedUp = true;
        this.currentPosition = this.homePosition;
        this.carrierPlayer = null;

        // Spawn flag slightly above spawner prop to avoid collision
        let flagOffset = mod.CreateVector(0.0, 0.1, 0.0);
        
        // Spawn flag prop at home
        if (this.flagProp && mod.GetObjId(this.flagProp) > 0) {
            mod.UnspawnObject(this.flagProp);
        }
        
        // Enable flag VFX using VFXManager
        const vfxMgr = vfxManager;
        vfxMgr.setColor(this.smokeVFXId, GetTeamColor(this.team));
        vfxMgr.setEnabled(this.smokeVFXId, true);
        vfxMgr.setPosition(this.smokeVFXId, this.currentPosition, ZERO_VEC);

        this.flagProp = mod.SpawnObject(
            FLAG_PROP, 
            mod.Add(this.homePosition, flagOffset),
            ZERO_VEC
        );

        // If we're using an MCOM, disable it to hide the objective marker
        let mcom: mod.MCOM = this.flagProp as mod.MCOM;
        if(mcom)
            mod.EnableGameModeObjective(mcom, false);
        
        // Update defend icons for all opposing teams using WorldIconManager
        const iconMgr = worldIconManager;
        for (const [teamId, iconId] of this.carriedIconIds.entries()) {
            iconMgr.setColor(iconId, GetTeamColor(this.team));
            iconMgr.setIcon(iconId, mod.WorldIconImages.Flag);
            iconMgr.setText(iconId, mod.Message(mod.stringkeys.pickup_flag_label));
            iconMgr.setEnabled(iconId, false, false); // Hide both icon and text
        }

        // Update recover icon using WorldIconManager
        iconMgr.setColor(this.recoverIconId, GetTeamColor(this.team));
        iconMgr.setIcon(this.recoverIconId, mod.WorldIconImages.Flag);
        iconMgr.setText(this.recoverIconId, mod.Message(mod.stringkeys.recover_flag_label));
        iconMgr.setEnabled(this.recoverIconId, false, false); // Hide both icon and text

        // Update interaction point
        this.UpdateFlagInteractionPoint();
    }
    
    PickupFlag(player: mod.Player): void {
        if (!this.canBePickedUp) {
            if (DEBUG_MODE) {
                console.log("Flag cannot be picked up yet (delay active)");
                mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_pickup_delay));
            }
            return;
        }
        
        if(!CARRIER_CAN_HOLD_MULTIPLE_FLAGS && IsCarryingAnyFlag(player)){
            if(DEBUG_MODE)
                mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_already_holding_flag));
            return;
        }

        // Store initial state for event
        const wasAtHome = this.isAtHome;

        // Play spawner sound alarm
        if(this.isAtHome){
            this.PlayFlagAlarm().then(() => console.log("Flag alarm stopped"));
        }

        // Set flag state
        this.numFlagTimesPickedUp += 1;
        this.isAtHome = false;
        this.isBeingCarried = true;
        this.isDropped = false;
        this.carrierPlayer = player;
        this.lastCarrier = player;

        // Play VO voice lines
        this.PlayFlagTakenVO();

        // Play pickup SFX
        let pickupSfxOwner: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_EnemyPickedUpCache_OneShot2D, this.homePosition, ZERO_VEC);
        mod.PlaySound(pickupSfxOwner, 1, this.team);
        for(let teamID of GetOpposingTeamsForFlag(this)){
            let pickupSfxCapturer: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_FriendlyCapturedCache_OneShot2D, this.homePosition, ZERO_VEC);
            mod.PlaySound(pickupSfxCapturer, 1, mod.GetTeam(teamID));
        }

        // Disable VFX
        if(this.pickupAvailableVFX){
            mod.EnableVFX(this.pickupAvailableVFX, false); 
        }

        // Remove flag prop
        if(!FLAG_FOLLOW_MODE){
            if (this.flagProp) {
                mod.UnspawnObject(this.flagProp);
                this.flagProp = null;
            }
        } else {
            this.tetherFlagVFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_WireGuidedMissile_SpooledWire, this.currentPosition, ZERO_VEC) as mod.VFX;
            this.tetherPlayerVFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_WireGuidedMissile_SpooledWire, this.currentPosition, ZERO_VEC) as mod.VFX;
            mod.EnableVFX(this.tetherFlagVFX, true);
            mod.EnableVFX(this.tetherPlayerVFX, true);
        }

        // Make sure to clear follow buffer so we get new points
        this.followPoints = [];

        // Flag carriers need updated weapons
        this.RestrictCarrierWeapons(player);

        // Spot the target on the minimap indefinitely
        mod.SpotTarget(this.carrierPlayer, mod.SpotStatus.SpotInMinimap);
        
        // Show all carried icons for opposing teams using WorldIconManager
        const iconMgr = worldIconManager;
        for (const [teamId, iconId] of this.carriedIconIds.entries()) {
            iconMgr.setEnabled(iconId, true, true); // Show both icon and text
        }
        iconMgr.setEnabled(this.recoverIconId, true, true); // Show both icon and text

        // Set VFX properties using VFXManager
        vfxManager.setColor(this.smokeVFXId, GetTeamColor(this.team));

        // Notify all players
        const message = mod.Message(mod.stringkeys.team_flag_taken, GetTeamName(this.team));
        if(DEBUG_MODE)
            mod.DisplayHighlightedWorldLogMessage(message);

        // Remove roaming flag interaction point
        if(this.flagInteractionPoint){
            mod.UnspawnObject(this.flagInteractionPoint);
        }
        
        // Emit flag taken event
        this.events.emit('flagTaken', {
            flag: this,
            player: player,
            isAtHome: wasAtHome
        });
        
        // Emit state changed event
        this.events.emit('flagStateChanged', {
            flag: this,
            isAtHome: this.isAtHome,
            isBeingCarried: this.isBeingCarried,
            isDropped: this.isDropped
        });
        
        if (DEBUG_MODE) {
            const carrierTeam = mod.GetTeam(this.carrierPlayer);
            const carrierTeamId = mod.GetObjId(carrierTeam);
            console.log(`Flag picked up by player on team ${carrierTeamId}`);
        }
    }
    
    async DropFlag(position?: mod.Vector, direction?: mod.Vector, dropDistance: number = FLAG_DROP_DISTANCE, useProjectileThrow?: boolean): Promise<void> {
        if (!this.isBeingCarried) return;

        // Store previous carrier for event
        const previousCarrier = this.carrierPlayer;

        this.isAtHome = false;
        this.isBeingCarried = false;
        this.isDropped = true;
        this.canBePickedUp = false;
        useProjectileThrow = useProjectileThrow ?? FLAG_ENABLE_ARC_THROW;
        let facingDir: mod.Vector = ZERO_VEC;
        let throwDirectionAndSpeed: mod.Vector = ZERO_VEC;
        let startRaycastID: number = RaycastManager.GetID();    // For debugging how many rays we're using

        // Determine drop position and direction
        if(this.carrierPlayer){
            let soldierPosition = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetPosition);
            facingDir = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetFacingDirection);

            // Flatten player look direction so it is parallel to X and Z axis
            position = position ?? soldierPosition;
            direction = direction ?? mod.Normalize(mod.CreateVector(mod.XComponentOf(facingDir), 0, mod.ZComponentOf(facingDir)));
            
            // Get jsPlayer to obtain cached velocity
            let jsPlayer = JSPlayer.get(this.carrierPlayer);
            if(jsPlayer){
                throwDirectionAndSpeed = mod.Add(mod.Multiply(facingDir, FLAG_THROW_SPEED), jsPlayer.velocity);
            }

            this.RestoreCarrierWeapons(this.carrierPlayer);
            mod.RemoveUIIcon(this.carrierPlayer);

            // Unspot the carrier
            mod.SpotTarget(this.carrierPlayer, mod.SpotStatus.Unspot);
        } else {
            position = position ?? this.currentPosition;
            direction = direction ?? mod.DownVector();
            throwDirectionAndSpeed = mod.Multiply(direction, FLAG_THROW_SPEED);
        }
        
        // Remove old flag if it exists - it shouldn't but lets make sure
        if(!FLAG_FOLLOW_MODE){
            try{
                if (this.flagProp)
                    mod.UnspawnObject(this.flagProp);
            } catch(error: unknown){
                console.log("Couldn't unspawn flag prop");
            }
        } else {
            if(this.tetherFlagVFX && this.tetherPlayerVFX){
                mod.UnspawnObject(this.tetherFlagVFX);
                mod.UnspawnObject(this.tetherPlayerVFX);
            }
        }
       
        // Flag rotation based on facing direction
        // TODO: replace with facing angle and hit normal
        let flagRotationVec = Math2.Vec3.FromVector(facingDir).DirectionToEuler(); //mod.CreateVector(0, mod.ArctangentInRadians(mod.XComponentOf(direction) / mod.ZComponentOf(direction)), 0);
        let flagRotationFlat = new Math2.Vec3(0, flagRotationVec.y, 0);
        let flagRotation = flagRotationFlat.ToVector();

        // Initially spawn flag at carrier position - it will be moved by animation
        let initialPosition = position;
        
        if(!FLAG_FOLLOW_MODE){
            //this.flagProp = mod.SpawnObject(FLAG_PROP, initialPosition, flagRotation);
        }

        if(DEBUG_MODE) console.log("this.flagProp = mod.SpawnObject(FLAG_PROP, initialPosition, flagRotation);");

        // Play yeet SFX
        let yeetSfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Soldier_Ragdoll_OnDeath_OneShot3D, initialPosition, ZERO_VEC);
        mod.PlaySound(yeetSfx, 1);

        // Clear the carrierPlayer when the flag has left the player
        this.carrierPlayer = null;

        // Animate flag with concurrent raycast generation
        if(useProjectileThrow && !FLAG_FOLLOW_MODE) {
            if(DEBUG_MODE) console.log("Starting concurrent flag animation");
            
            // Create the generator for projectile path with validation callback
            const pathGenerator = RaycastManager.ProjectileRaycastGenerator(
                mod.Add(
                    mod.Add(mod.Add(position, mod.CreateVector(0.0, SOLDIER_HEIGHT, 0.0)), mod.Multiply(facingDir, 1.5)) ,     // Start above soldier head to avoid self collisions
                    mod.Multiply(facingDir, 0.75)        // Start projectile arc away from player to avoid intersections
                ),
                throwDirectionAndSpeed,                 // Velocity
                FLAG_DROP_RAYCAST_DISTANCE,             // Max drop distance
                4,                                      // Sample rate
                this.carrierPlayer,                     // Origin player (now null but was set earlier)
                9.8,                                    // gravity
                DEBUG_MODE,                             // Debug visualization
                5,                                      // Interpolation steps
                FLAG_TERRAIN_FIX_PROTECTION ? mod.YComponentOf(initialPosition) : undefined,    // Clamp Y distance arc can travel to fix terrain raycast bug
                async (hitPoint: mod.Vector, hitNormal?: mod.Vector) => {
                    // This callback is called when the projectile hits something
                    if(DEBUG_MODE) {
                        console.log(`[DropFlag] Hit detected at ${VectorToString(hitPoint)}, validating position`);
                    }
                    
                    // Move validation location slightly away from the hit location in direction of the hit normal
                    let groundLocationAdjusted: mod.Vector = mod.Add(
                        hitPoint, 
                        mod.Multiply(hitNormal ?? mod.UpVector(), SPAWN_VALIDATION_HEIGHT_OFFSET)
                    );
                    
                    // Adjust flag spawn location to make sure it's not clipping into a wall
                    const validatedFlagSpawn = await RaycastManager.ValidateSpawnLocationWithRadialCheck(
                        groundLocationAdjusted,             // Hit location, vertically adjusted upwards to avoid clipping into the ground plane
                        FLAG_COLLISION_RADIUS,              // Collision radius of the flag that is safe to spawn it in
                        FLAG_COLLISION_RADIUS_OFFSET,       // Offset to start rays from
                        SPAWN_VALIDATION_DIRECTIONS,        // How many direction rays to cast around the object
                        FLAG_DROP_RAYCAST_DISTANCE,         // How far down to look for a valid ground location
                        SPAWN_VALIDATION_MAX_ITERATIONS,    // Adjustment iterations, in case we don't find a valid location
                        DEBUG_MODE,                         // Debug
                        FLAG_TERRAIN_FIX_PROTECTION ? mod.YComponentOf(initialPosition) : undefined
                    );

                    let endRayCastID: number = RaycastManager.GetID();
                    if(DEBUG_MODE){
                        console.log(`Flag drop took ${endRayCastID - startRaycastID} raycasts to complete`);
                        if (!validatedFlagSpawn.isValid) {
                            console.log(`Warning: ValidateSpawnLocationWithRadialCheck could not find valid location`);
                        }
                    }

                    // Use the validated position if valid, otherwise use the hit point
                    return validatedFlagSpawn.isValid ? validatedFlagSpawn.position : hitPoint;
                }
            );

            // Animate concurrently with path generation
            await animationManager.AnimateAlongGeneratedPath(
                undefined,
                pathGenerator,
                20,  // minBufferSize - stay ahead of animation to avoid catching up during validation
                {
                    speed: 800,
                    onSpawnAtStart: ():mod.Object | null  => {
                        // Disable smoke whilst flag is thrown to avoid flare leaking out
                        vfxManager.setEnabled(this.smokeVFXId, false);

                        // Spawn prop
                        this.flagProp = mod.SpawnObject(FLAG_PROP, initialPosition, flagRotation);

                        // If we're using an MCOM, disable it to hide the objective marker
                        let mcom: mod.MCOM = this.flagProp as mod.MCOM;
                        if(mcom)
                            mod.EnableGameModeObjective(mcom, false);
                        
                        return this.flagProp;
                    },
                    onProgress: (progress: number, position: mod.Vector) => {
                    },
                    rotation: flagRotation
                }
            ).catch((reason: any) => {
                console.log(`Concurrent animation path failed with reason ${reason}`);
            });
            
            // Update current position to final animated position
            this.currentPosition = this.flagProp ? mod.GetObjectPosition(this.flagProp) : position;
            
            if(DEBUG_MODE) console.log("Concurrent flag animation complete");
        } else if(!useProjectileThrow) {
            // Fallback: just set position directly
            this.currentPosition = position;
            if(this.flagProp) {
                mod.SetObjectTransform(this.flagProp, mod.CreateTransform(this.currentPosition, flagRotation));
            }
        }

        // Play impact VFX using VFXManager
        vfxManager.setPosition(this.impactVFXId, this.currentPosition, ZERO_VEC);
        vfxManager.setEnabled(this.impactVFXId, true);

        // Update capture icons for all opposing teams using WorldIconManager
        const iconMgr = worldIconManager;
        let flagIconOffset = mod.Add(this.currentPosition, mod.CreateVector(0,2,0));
        for (const [teamId, iconId] of this.carriedIconIds.entries()) {
            iconMgr.setEnabled(iconId, true, true); // Show both icon and text
            iconMgr.setText(iconId, mod.Message(mod.stringkeys.pickup_flag_label));
            iconMgr.setPosition(iconId, flagIconOffset);
        }
        iconMgr.setEnabled(this.recoverIconId, true, true); // Show both icon and text
        iconMgr.setPosition(this.recoverIconId, flagIconOffset);

        // Update VFX using VFXManager
        vfxManager.setPosition(this.smokeVFXId, this.currentPosition, ZERO_VEC);
        vfxManager.setColor(this.smokeVFXId, GetTeamDroppedColor(this.team));

        // Play drop VO
        let friendlyVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
        if(friendlyVO){
            mod.PlayVO(friendlyVO, mod.VoiceOverEvents2D.ObjectiveContested, mod.VoiceOverFlags.Alpha, this.team);
        }

        // Start timers
        this.StartAutoReturn(FLAG_AUTO_RETURN_TIME, this.numFlagTimesPickedUp).then( () => {console.log(`Flag ${this.teamId} auto-returning to base`)});
        this.StartPickupDelay().then(() => {
            // Activate FX using VFXManager
            vfxManager.setEnabled(this.smokeVFXId, true);
            vfxManager.setPosition(this.sparksVFXId, this.currentPosition, ZERO_VEC);
            vfxManager.setEnabled(this.sparksVFXId, true);

            // Update the position of the flag interaction point
            this.UpdateFlagInteractionPoint();   
            
            console.log("Flag pickup delay complete");
        });
        
        // Emit flag dropped event
        this.events.emit('flagDropped', {
            flag: this,
            position: this.currentPosition,
            previousCarrier: previousCarrier
        });
        
        // Emit state changed event
        this.events.emit('flagStateChanged', {
            flag: this,
            isAtHome: this.isAtHome,
            isBeingCarried: this.isBeingCarried,
            isDropped: this.isDropped
        });
        
        if (DEBUG_MODE) {
            console.log(`Flag dropped`);
            mod.DisplayHighlightedWorldLogMessage(
            mod.Message(mod.stringkeys.flag_dropped, GetTeamName(this.team)));
        }

    }

    UpdateFlagInteractionPoint(){
        try{
            if(this.flagInteractionPoint){
                mod.UnspawnObject(this.flagInteractionPoint);
            }
        } catch(error: unknown){
            console.log("Interaction zone already unspawned");
        }
        console.log("Spawning updated interaction zone for flag");

        let flagInteractOffset = mod.Add(this.currentPosition, mod.CreateVector(0, FLAG_INTERACTION_HEIGHT_OFFSET, 0));
        this.flagInteractionPoint = mod.SpawnObject(mod.RuntimeSpawn_Common.InteractPoint, flagInteractOffset, ZERO_VEC);
        if(this.flagInteractionPoint){
            mod.EnableInteractPoint(this.flagInteractionPoint, true);
        }
    }
    
    async StartPickupDelay(): Promise<void> {
        let vfxHeightOffset = mod.CreateVector(0, 1.7, 0);

        // Lock the flag icons using WorldIconManager
        const iconMgr = worldIconManager;
        iconMgr.setIcon(this.recoverIconId, mod.WorldIconImages.Alert);
        iconMgr.setText(this.recoverIconId, mod.Message(mod.stringkeys.locked_flag_label));
        for(let [teamId, iconId] of this.carriedIconIds){
            iconMgr.setIcon(iconId, mod.WorldIconImages.Alert);
            iconMgr.setText(iconId, mod.Message(mod.stringkeys.locked_flag_label));
        }

        // Charging VFX
        if(this.pickupChargingVFX){
            mod.MoveVFX(this.pickupChargingVFX, mod.Add(this.currentPosition, vfxHeightOffset), ZERO_VEC);
            mod.EnableVFX(this.pickupChargingVFX, true); 
        }
        
        // Play drop SFX
        if(this.pickupTimerStartSFX && this.pickupTimerRiseSFX && this.lastCarrier){
            mod.PlaySound(this.pickupTimerStartSFX, 1);
            await mod.Wait(0.1);
            mod.PlaySound(this.pickupTimerRiseSFX, 1);
        }

        // Wait for flag timer to expire
        await mod.Wait(FLAG_PICKUP_DELAY);
        
        // Play final sound when flag is ready to pickup
        if(this.pickupTimerStopSFX)
            mod.PlaySound(this.pickupTimerStopSFX, 1);

        // Activate flag pickup VFX
        if(this.pickupChargingVFX && this.pickupAvailableVFX){
            mod.EnableVFX(this.pickupChargingVFX, false);
            mod.MoveVFX(this.pickupAvailableVFX, mod.Add(this.currentPosition, vfxHeightOffset), ZERO_VEC);
            mod.EnableVFX(this.pickupAvailableVFX, true); 
        }

        // Reset flag icons using WorldIconManager
        iconMgr.setText(this.recoverIconId, mod.Message(mod.stringkeys.recover_flag_label));
        iconMgr.setIcon(this.recoverIconId, mod.WorldIconImages.Flag);
        for(let [teamId, iconId] of this.carriedIconIds){
            iconMgr.setIcon(iconId, mod.WorldIconImages.Flag);
            iconMgr.setText(iconId, mod.Message(mod.stringkeys.pickup_flag_label));
        }

        if (this.isDropped) {
            this.canBePickedUp = true;
            this.lastCarrier = null;
        }
    }

    ReturnFlag(player?:mod.Player): void {
        if(DEBUG_MODE)
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.team_flag_returned));
        this.PlayFlagReturnedSFX();
        
        // Emit flag returned event (before reset)
        this.events.emit('flagReturned', {
            flag: this,
            player: player
        });
        
        this.ResetFlag();
    }
    
    ResetFlag(): void {
        if (this.carrierPlayer) {
            this.RestoreCarrierWeapons(this.carrierPlayer);
            mod.RemoveUIIcon(this.carrierPlayer);
        }
        
        if (this.flagProp) {
            mod.UnspawnObject(this.flagProp);
            this.flagProp = null;
        }

        // Disable VFX
        if(this.pickupAvailableVFX){
            mod.EnableVFX(this.pickupAvailableVFX, false); 
        }
        
        this.SpawnFlagAtHome();
        this.StopFlagAlarm();
        
        if (DEBUG_MODE) {
            console.log(`Team ${this.teamId} flag returned`);
            // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_returned, this.teamId));
        }
    }
    
    CheckAutoReturn(): void {
        if (!this.isDropped) return;
        
        const currentTime = GetCurrentTime();
        if (currentTime >= this.autoReturnTime) {
            if (DEBUG_MODE) {
                console.log(`Flag ${this.team} auto-returning to base`);
                //mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_auto_return));
            }
            
            this.ReturnFlag();
        }
    }

    async StartAutoReturn(returnDelay: number, expectedNumTimesPickedUp: number): Promise<void> {
        let currFlagTimesPickedUp = expectedNumTimesPickedUp;
        await mod.Wait(returnDelay);
        if(this.isDropped && !this.isBeingCarried && !this.isAtHome && currFlagTimesPickedUp === this.numFlagTimesPickedUp){
            console.log(`Flag auto return. Number of times returned ${this.numFlagTimesPickedUp}. Expected ${currFlagTimesPickedUp}`);
            
            this.PlayFlagReturnedSFX();

            // Emit flag returned event with auto-return flag
            this.events.emit('flagReturned', {
                flag: this,
                player: undefined
            });

            
            this.ResetFlag();
        }
    }

    SlowUpdate(timeDelta:number) {
        if(this.isDropped){
            let mcom: mod.MCOM = this.flagProp as mod.MCOM;
            if(mcom)
                mod.EnableGameModeObjective(mcom, false);
        }
    }

    FastUpdate(timeDelta:number) {
        if (this.isBeingCarried) {
            this.UpdateCarrier(timeDelta);
        }
    }
    
    UpdateCarrier(timeDelta: number): void {
        if (!this.isBeingCarried || !this.carrierPlayer) return;
        
        if (!mod.IsPlayerValid(this.carrierPlayer) || 
            !mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsAlive)) {
            return;
        }
        
        // Get the soldier position for attaching effects
        let currentSoldierPosition = mod.GetSoldierState(
            this.carrierPlayer, 
            mod.SoldierStateVector.GetPosition);
        let currentRotation = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetFacingDirection);
        let currentVelocity = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetLinearVelocity);
        let soldierInAir = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsInAir);
        let soldierParachuting = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsParachuting);
        let soldierInVehicle = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsInVehicle);

        // Update jsPlayer velocity
        let jsPlayer = JSPlayer.get(this.carrierPlayer);
        if(jsPlayer){
            jsPlayer.velocity = currentVelocity
        }

        if(FLAG_FOLLOW_MODE){
            this.FollowPlayer(currentSoldierPosition, soldierParachuting);
        } else {
            this.currentPosition = currentSoldierPosition;
        }
        
        // Make smoke effect follow carrier using VFXManager
        vfxManager.setPosition(this.smokeVFXId, this.currentPosition, currentRotation);

        if(this.hoverVFX){
            if(soldierParachuting){
                mod.EnableVFX(this.hoverVFX, true);
                mod.MoveVFX(this.hoverVFX, this.currentPosition, Math2.Vec3.FromVector(mod.ForwardVector()).DirectionToEuler().ToVector());
            } else {
                mod.EnableVFX(this.hoverVFX, false);
            }
        }

        // Move carrier icons
        this.UpdateCarrierIcon();

        // Force disable carrier weapons
        this.CheckCarrierDroppedFlag(this.carrierPlayer);
    }

    FollowPlayer(currentSoldierPosition: mod.Vector, isParachuting?: boolean) {
        let distanceToPlayer = Math2.Vec3.FromVector(currentSoldierPosition).Subtract(Math2.Vec3.FromVector(this.currentPosition)).Length();

        // Always add player position to buffer to maintain continuous path
        let currentFlagPos = Math2.Vec3.FromVector(this.currentPosition);
        let currentSoldierPos = Math2.Vec3.FromVector(currentSoldierPosition);
        let soldierToFlagDir = currentSoldierPos.Subtract(currentFlagPos);
        let soldierToFlagDirScaled = soldierToFlagDir.MultiplyScalar(0.85);
        let flagPositionScaled = currentFlagPos.Add(soldierToFlagDirScaled);
        let soldierParachuting = isParachuting ?? false;
        this.followPoints.push(flagPositionScaled.ToVector());

        // Keep buffer within max sample size
        if (this.followPoints.length > FLAG_FOLLOW_SAMPLES) {
            this.followPoints.shift(); // Remove oldest to maintain size
        }

        // Process buffer when we have minimum required points
        if (this.followPoints.length >= FLAG_FOLLOW_SAMPLES) {
            // Always consume one position per frame to keep buffer flowing
            let nextBufferPosition = this.followPoints.shift() ?? this.currentPosition;

            // Check if this position would maintain proper distance from player
            let distanceNextPosToPlayer = Math2.Vec3.FromVector(currentSoldierPosition).Subtract(Math2.Vec3.FromVector(nextBufferPosition)).Length();

            // Use hysteresis to prevent oscillation: stricter threshold to stop, looser to continue
            // This accounts for the dampening factor making positions closer to flag
            let minDistanceToMove = FLAG_FOLLOW_DISTANCE * 0.7; // Lower threshold to allow movement

            // Only move flag if position maintains safe distance
            if (distanceNextPosToPlayer > minDistanceToMove) {
                // Apply exponential smoothing to position
                // smoothedPosition = alpha * newPosition + (1 - alpha) * previousSmoothedPosition
                let targetPos = Math2.Vec3.FromVector(nextBufferPosition);
                let currentSmoothedPos = Math2.Vec3.FromVector(this.smoothedPosition);
                let smoothedPos = targetPos.MultiplyScalar(FLAG_FOLLOW_POSITION_SMOOTHING)
                    .Add(currentSmoothedPos.MultiplyScalar(1 - FLAG_FOLLOW_POSITION_SMOOTHING));
                
                this.smoothedPosition = smoothedPos.ToVector();
                this.currentPosition = this.smoothedPosition;

                // Calculate direction to next point for rotation
                let nextPosition = this.followPoints.length > 1 ? this.followPoints[0] : this.currentPosition;
                let direction = Math2.Vec3.FromVector(nextPosition).Subtract(Math2.Vec3.FromVector(this.currentPosition)).MultiplyScalar(-1).Normalize();

                // Remove pitch and roll if we're hovering
                direction = soldierParachuting ? direction.Multiply(new Math2.Vec3(1,0,1)).Normalize() : direction;
                let targetRotation = direction.Length() > 0.01 ? direction.DirectionToEuler() : new Math2.Vec3(0, 0, 0);
                
                // Apply exponential smoothing to rotation
                // smoothedRotation = alpha * newRotation + (1 - alpha) * previousSmoothedRotation
                let currentSmoothedRot = Math2.Vec3.FromVector(this.smoothedRotation);
                let smoothedRot = targetRotation.MultiplyScalar(FLAG_FOLLOW_ROTATION_SMOOTHING)
                    .Add(currentSmoothedRot.MultiplyScalar(1 - FLAG_FOLLOW_ROTATION_SMOOTHING));
                
                this.smoothedRotation = smoothedRot.ToVector();

                if (this.flagProp) {
                    mod.SetObjectTransform(this.flagProp, mod.CreateTransform(this.smoothedPosition, this.smoothedRotation));

                    if (this.dragSFX) {
                        mod.PlaySound(this.dragSFX, 1);
                    }
                }

                if(this.tetherFlagVFX && this.tetherPlayerVFX){
                    mod.MoveVFX(this.tetherFlagVFX, this.smoothedPosition, soldierToFlagDir.DirectionToEuler().ToVector());
                    //mod.SetVFXScale(this.tetherFlagVFX, 2);

                    let playerToFlagRot = smoothedPos.Subtract(currentSoldierPos).DirectionToEuler();
                    mod.MoveVFX(this.tetherPlayerVFX, currentSoldierPosition, playerToFlagRot.ToVector());
                    // mod.SetVFXScale(this.tetherPlayerVFX, 2);
                }
            }
            // If position is too close, we consumed it but didn't move - flag stays at currentPosition
        }
    }

    UpdateCarrierIcon(){
        // Move flag icons for all opposing teams using WorldIconManager
        const iconMgr = worldIconManager;
        let flagIconOffset = mod.Add(this.currentPosition, mod.CreateVector(0,2.5,0));
        const shouldShowIcon = this.isBeingCarried || this.isDropped;

        for (const [teamId, iconId] of this.carriedIconIds.entries()) {
            iconMgr.setPosition(iconId, flagIconOffset);
            iconMgr.setIconEnabled(iconId, shouldShowIcon);
        }
        iconMgr.setPosition(this.recoverIconId, flagIconOffset);
        iconMgr.setIconEnabled(this.recoverIconId, shouldShowIcon);
    }
    
    RestrictCarrierWeapons(player: mod.Player): void {
        // Force equip sledgehammer
        if(CARRIER_FORCED_WEAPON)
            mod.AddEquipment(player, CARRIER_FORCED_WEAPON);

        if(!mod.IsInventorySlotActive(player, CARRIER_FORCED_WEAPON_SLOT)){
            mod.ForceSwitchInventory(player, CARRIER_FORCED_WEAPON_SLOT);
        }
        
        if (DEBUG_MODE) {
            console.log(`${player} weapons restricted`);
        }
    }

    CheckCarrierDroppedFlag(player: mod.Player): void {
        if(this.carrierPlayer){
            if(mod.GetObjId(this.carrierPlayer) == mod.GetObjId(player)){
                if(!mod.IsInventorySlotActive(player, CARRIER_FORCED_WEAPON_SLOT)){
                    this.DropFlag();
                }
            }
        }
    }
    
    RestoreCarrierWeapons(player: mod.Player): void {
        // Note: In a full implementation, you'd want to track and restore the player's original loadout
        mod.AddEquipment(player, mod.Gadgets.Melee_Combat_Knife);
        mod.ForceSwitchInventory(player, mod.InventorySlots.PrimaryWeapon);

        if (DEBUG_MODE) {
            console.log(`${mod.GetObjId(player)} Carrier weapons restored`);
            // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.carrier_weapons_restored));
        }
    }
    
    IsPlayerOnThisTeam(player: mod.Player): boolean {
        return mod.GetObjId(mod.GetTeam(player)) === this.teamId;
    }
    
    // New multi-team helper methods
    CanBePickedUpBy(playerTeamId: number): boolean {
        // Can't pick up your own team's flag
        if (this.owningTeamId === playerTeamId) return false;
        
        // Check whitelist if specified
        if (this.allowedCapturingTeams.length > 0) {
            return this.allowedCapturingTeams.includes(playerTeamId);
        }
        
        // Empty whitelist = any opposing team can capture
        return true;
    }
    
    GetFlagColor(): mod.Vector {
        // Use custom color if specified, otherwise use owning team's color
        if (this.customColor) return this.customColor;
        return GetTeamColorById(this.owningTeamId);
    }

    async PlayFlagAlarm(): Promise<void>{
        this.alarmSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Alarm, this.currentPosition, ZERO_VEC);
        if(this.alarmSFX){
            // mod.EnableSFX(this.alarmSFX, true);
            mod.PlaySound(this.alarmSFX, 1, this.currentPosition, 100);
        }
        // Stop flag sound after a duration
        await mod.Wait(FLAG_SFX_DURATION);
        this.StopFlagAlarm();
    }

    PlayFlagTakenVO(){
        let vo_flag = DEFAULT_TEAM_VO_FLAGS.get(this.teamId);

        // Play VO for flag owning team
        let flagOwningTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
        if(flagOwningTeamVO && vo_flag){
            mod.PlayVO(flagOwningTeamVO, mod.VoiceOverEvents2D.ObjectiveLost, vo_flag, this.team);
        }
        
        // Play VO for all opposing teams
        if(this.carrierPlayer && vo_flag){
            let carrierTeam:mod.Team = mod.GetTeam(this.carrierPlayer);
            if (carrierTeam) {
                let capturingTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
                if(capturingTeamVO && vo_flag){
                    mod.PlayVO(capturingTeamVO, mod.VoiceOverEvents2D.ObjectiveLockdownFriendly, vo_flag, carrierTeam);
                }
            }
        }
    }

    StopFlagAlarm(){
        if(this.alarmSFX){
            mod.StopSound(this.alarmSFX);
        }
    }

    PlayFlagReturnedSFX(){
        let vo_flag = DEFAULT_TEAM_VO_FLAGS.get(this.teamId);

        // Play returned SFX
        let pickupSfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_ObjetiveUnlockReveal_OneShot2D, this.homePosition, ZERO_VEC);
        // mod.EnableSFX(pickupSfx, true);
        mod.PlaySound(pickupSfx, 1);

        // Play VO for flag owning team
        let flagOwningTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
        if(flagOwningTeamVO && vo_flag){
            mod.PlayVO(flagOwningTeamVO, mod.VoiceOverEvents2D.ObjectiveNeutralised, vo_flag, this.team);
        }
        
        // Play VO for all opposing teams
        const opposingTeams = GetOpposingTeams(this.owningTeamId);
        for (const opposingTeamId of opposingTeams) {
            const opposingTeam = teams.get(opposingTeamId);
            if (opposingTeam) {
                let capturingTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
                if(capturingTeamVO && vo_flag){
                    mod.PlayVO(capturingTeamVO, mod.VoiceOverEvents2D.ObjectiveNeutralised, vo_flag, opposingTeam);
                }
            }
        }
    }
}

function HandleFlagInteraction(
    player: mod.Player, 
    playerTeamId: number, 
    flag: Flag
): void {
    
    if (DEBUG_MODE) {
        // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.red_flag_position, mod.XComponentOf(flagData.homePosition), mod.YComponentOf(flagData.homePosition), mod.ZComponentOf(flagData.homePosition)));
    }

    // Enemy team trying to take flag
    if (playerTeamId !== flag.teamId) {
        if (flag.isAtHome || (flag.isDropped && flag.canBePickedUp)) {
            flag.PickupFlag(player);
        } else if (flag.isDropped && !flag.canBePickedUp) {
            if(DEBUG_MODE){
                mod.DisplayHighlightedWorldLogMessage(
                    mod.Message(mod.stringkeys.waiting_to_take_flag),
                    player
                );
            }
        }
    }
    // Own team trying to return dropped flag
    else if (playerTeamId === flag.teamId){
        if(flag.isDropped){
            if(DEBUG_MODE)
                mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.team_flag_returned, GetTeamName(flag.team)));
            flag.PlayFlagReturnedSFX();
            flag.ReturnFlag(player);
        } else if(flag.isAtHome) {
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_friendly_at_home), player);
        }
    }
}


function GetFlagTeamIdOffset(team: mod.Team): number {
    let teamID = mod.GetObjId(team);
    return TEAM_ID_START_OFFSET + (teamID * TEAM_ID_STRIDE_OFFSET);
}

function GetDefaultFlagSpawnIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_SPAWN_ID_OFFSET;
}

function DropAllFlags(player: mod.Player){
    let playerPos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
    let playerPosX = mod.XComponentOf(playerPos);
    let playerPosY = mod.YComponentOf(playerPos);
    let playerPosZ = mod.ZComponentOf(playerPos);
    let flagDropRadius = FLAG_DROP_RING_RADIUS;

    let carriedFlags = GetCarriedFlags(player);
    let angleInc = Math.PI * 2.0 / carriedFlags.length;

    let numFlags = carriedFlags;

    //Create a ring of coordinates
    for(let i = 0; i < carriedFlags.length; ++i){
        let angle = i * angleInc;
        let x = flagDropRadius * Math.cos(angle);
        let z = flagDropRadius * Math.sin(angle);
        carriedFlags[i].DropFlag(mod.Add(playerPos, mod.CreateVector(x, 0.0, z)));
    }
}

function GetCarriedFlags(player: mod.Player): Flag[] {
    return Array.from(flags.values()).filter((flag: Flag) => {
        if(!flag.carrierPlayer || !flag.isBeingCarried) return false;
        return mod.Equals(flag.carrierPlayer, player);
    }
    );
}

function IsCarryingAnyFlag(player: mod.Player): boolean {
    // Check all flags dynamically
    for (const [flagId, flagData] of flags.entries()) {
        if (flagData.carrierPlayer && mod.Equals(flagData.carrierPlayer, player)) {
            return true;
        }
    }
    return false;
}

// Was the player previously holding a flag?
function WasCarryingAnyFlag(player: mod.Player): boolean {
    // Check all flags dynamically
    for (const [flagId, flagData] of flags.entries()) {
        if (flagData.carrierPlayer && mod.Equals(flagData.lastCarrier, player)) {
            return true;
        }
    }
    return false;
}

function GetOpposingTeamsForFlag(flagData: Flag): number[] {
    // If flag has specific allowed capturing teams, return those
    if (flagData.allowedCapturingTeams.length > 0) {
        return flagData.allowedCapturingTeams;
    }
    
    // Otherwise return all teams except the flag owner
    return GetOpposingTeams(flagData.owningTeamId);
}


//==============================================================================================
// CAPTURE ZONE CLASS
//==============================================================================================

class CaptureZone {
    readonly team: mod.Team;
    readonly teamId: number;
    readonly areaTrigger: mod.AreaTrigger | undefined;
    readonly captureZoneID?: number;
    readonly captureZoneSpatialObjId?: number;
    readonly position: mod.Vector;
    readonly iconPosition: mod.Vector;
    readonly baseIcons?: Map<number, mod.WorldIcon>;// One icon per opposing team

    // WorldIcon manager IDs for tracking
    private baseIconIds: Map<number, string> = new Map();

    constructor(team: mod.Team, captureZoneID?: number, captureZoneSpatialObjId?:number){
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.captureZoneID = captureZoneID ? captureZoneID : GetDefaultFlagCaptureZoneAreaTriggerIdForTeam(team);
        this.captureZoneSpatialObjId = captureZoneSpatialObjId ? captureZoneSpatialObjId : GetDefaultFlagCaptureZoneSpatialIdForTeam(this.team);
        this.iconPosition = ZERO_VEC;
        this.position = ZERO_VEC;

        this.areaTrigger = this.captureZoneID ? mod.GetAreaTrigger(this.captureZoneID) : undefined;
        if(!this.areaTrigger)
            console.log(`Could not find team ${this.teamId} area trigger for capture zone ID ${this.captureZoneID}`);

        if(this.captureZoneSpatialObjId){
            let captureZoneSpatialObj = mod.GetSpatialObject(this.captureZoneSpatialObjId);
            if(captureZoneSpatialObj)
            {
                this.position = mod.GetObjectPosition(captureZoneSpatialObj);

                // Get our world icon position for this capture zone
                this.iconPosition = mod.Add(this.position, mod.CreateVector(0.0, FLAG_ICON_HEIGHT_OFFSET, 0.0));

                // Register WorldIcons with WorldIconManager
                const iconMgr = worldIconManager;
                this.baseIcons = new Map();

                // Create global world icon
                const teamIconId = `capturezone_${this.teamId}_team${this.teamId}`;
                let teamIcon = iconMgr.createIcon(
                    teamIconId,
                    this.iconPosition,
                    {
                        icon: mod.WorldIconImages.Triangle,
                        iconEnabled: true,
                        textEnabled: true,
                        text: mod.Message(mod.stringkeys.capture_zone_label, GetTeamName(this.team)),
                        color: GetTeamColorById(this.teamId),
                    }
                );
                this.baseIcons.set(mod.GetObjId(team), teamIcon);
                this.baseIconIds.set(mod.GetObjId(team), teamIconId);

                this.UpdateIcons();
            } else {
                console.log(`Can't create WorldIcon for ${this.teamId} capture zone. Spatial object ${captureZoneSpatialObj} returned for id ${this.captureZoneSpatialObjId}}`);
            }
        } else {
            console.log(`Can't create WorldIcon for ${this.teamId} capture zone. Spatial object ID was ${this.captureZoneSpatialObjId}`);
        }
    }

    UpdateIcons(){
        // Use WorldIconManager methods instead of direct mod calls
        // This ensures we're updating the current icon even after refresh
        const iconMgr = worldIconManager;

        for(let [targetTeamId, iconId] of this.baseIconIds.entries()){
            if(targetTeamId == this.teamId){
                // Icon is for capture zone owner
            } else {
                // Icon is for opposing team
            }
            iconMgr.setText(iconId, mod.Message(mod.stringkeys.capture_zone_label, GetTeamName(this.team)));
            iconMgr.setIcon(iconId, mod.WorldIconImages.Triangle);
            iconMgr.setColor(iconId, GetTeamColorById(this.teamId));
            iconMgr.setPosition(iconId, this.iconPosition);
            iconMgr.setEnabled(iconId, true, true); // icon enabled, text enabled
        }
    } 

    HandleCaptureZoneEntry(player: mod.Player): void 
    {
        let jsPlayer = JSPlayer.get(player);
        let playerTeamId = mod.GetObjId(mod.GetTeam(player));

        GetCarriedFlags(player).forEach((flag:Flag) => {
            // Check if player is carrying an enemy flag
            if (!flag) {
                if (DEBUG_MODE) {
                    console.log(`Could not find a held flag for the provided player ${mod.GetObjId(player)}`);
                }
                return;
            }
            
            // Verify the flag is owned by an opposing team
            if (flag.owningTeamId === playerTeamId) {
                if (DEBUG_MODE) {
                    console.log(`Player ${mod.GetObjId(player)} entered their teams capture zone but doesn't have the enemy flag`);
                    // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.not_carrying_flag, player));
                }
                return;
            }
            
            // Verify player entered the capture zone for their own team
            if (this.teamId !== playerTeamId) {
                if (DEBUG_MODE) {
                    console.log(`Players team ${playerTeamId} but entered wrong capture zone ${this.teamId}`);
                }
                return;
            }
            
            // Check if own flag is at home (get player's team flag)
            const ownFlag = flags.get(playerTeamId);
            if (ownFlag && !ownFlag.isAtHome) {
                if(DEBUG_MODE){
                    mod.DisplayHighlightedWorldLogMessage(
                        mod.Message(mod.stringkeys.waiting_for_flag_return),
                        player
                    );
                }
                return;
            }
        
            // Team Score!
            ScoreCapture(player, flag, this.team);
        });

        
    }
}

function GetDefaultFlagCaptureZoneAreaTriggerIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_CAPTURE_ZONE_ID_OFFSET;
}

function GetDefaultFlagCaptureZoneSpatialIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_CAPTURE_ZONE_ICON_ID_OFFSET;
}

//==============================================================================================
// WORLD ICON MANAGER - Centralized management of WorldIcons with refresh support
//==============================================================================================

/**
 * Saved state for a WorldIcon to enable respawning with same properties
 */
interface WorldIconState {
    id: string;
    position: mod.Vector;
    text?: mod.Message;
    textEnabled: boolean;
    icon?: mod.WorldIconImages;
    iconEnabled: boolean;
    color?: mod.Vector;
    teamOwner?: mod.Team; // Team object for team scoping
    playerOwner?: mod.Player; // Player object for player scoping
}

/**
 * WorldIconManager - Manages all WorldIcons in the game
 * Handles refresh on player join by respawning icons with saved state
 *
 * Features:
 * - Automatic state tracking
 * - Respawn on player join (fixes visibility bug)
 * - Team/Player scoped icon support
 * - Centralized cleanup
 */
class WorldIconManager {
    private static instance: WorldIconManager;
    private icons: Map<string, mod.WorldIcon> = new Map();
    private iconStates: Map<string, WorldIconState> = new Map();

    private constructor() {
        if (DEBUG_MODE) {
            console.log('WorldIconManager: Initialized');
        }
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): WorldIconManager {
        if (!WorldIconManager.instance) {
            WorldIconManager.instance = new WorldIconManager();
        }
        return WorldIconManager.instance;
    }

    /**
     * Create and register a WorldIcon
     * @param id Unique identifier for this icon
     * @param position World position
     * @param options Optional configuration
     */
    createIcon(
        id: string,
        position: mod.Vector,
        options?: {
            text?: mod.Message;
            textEnabled?: boolean;
            icon?: mod.WorldIconImages;
            iconEnabled?: boolean;
            color?: mod.Vector;
            teamOwner?: mod.Team; // Team object for team scoping
            playerOwner?: mod.Player; // Player object for player scoping
        }
    ): mod.WorldIcon {
        // Delete existing icon if it exists
        if (this.icons.has(id)) {
            this.deleteIcon(id);
        }

        // Create the icon using the correct API
        const icon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, position, ZERO_VEC) as mod.WorldIcon;

        // Apply owner (team/player scope) if specified
        if (options?.teamOwner !== undefined) {
            mod.SetWorldIconOwner(icon, options.teamOwner);
        } else if (options?.playerOwner !== undefined) {
            mod.SetWorldIconOwner(icon, options.playerOwner);
        }

        // Apply text properties
        if (options?.text !== undefined) {
            mod.SetWorldIconText(icon, options.text);
        }
        const textEnabled = options?.textEnabled ?? false;
        mod.EnableWorldIconText(icon, textEnabled);

        // Apply icon properties
        if (options?.icon !== undefined) {
            mod.SetWorldIconImage(icon, options.icon);
        }
        const iconEnabled = options?.iconEnabled ?? false;
        mod.EnableWorldIconImage(icon, iconEnabled);

        // Apply color
        if (options?.color !== undefined) {
            mod.SetWorldIconColor(icon, options.color);
        }

        // Save state
        const state: WorldIconState = {
            id: id,
            position: position,
            text: options?.text,
            textEnabled: textEnabled,
            icon: options?.icon,
            iconEnabled: iconEnabled,
            color: options?.color,
            teamOwner: options?.teamOwner,
            playerOwner: options?.playerOwner
        };

        this.icons.set(id, icon);
        this.iconStates.set(id, state);

        if (DEBUG_MODE) {
            console.log(`WorldIconManager: Created icon '${id}'`);
        }

        return icon;
    }

    /**
     * Get a managed icon by ID
     */
    getIcon(id: string): mod.WorldIcon | undefined {
        return this.icons.get(id);
    }

    /**
     * Update icon position and save state
     */
    setPosition(id: string, position: mod.Vector): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconPosition(icon, position);
            state.position = position;
        }
    }

    /**
     * Update icon text and save state
     */
    setText(id: string, text: mod.Message): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconText(icon, text);
            state.text = text;
        }
    }

    /**
     * Update icon image and save state
     */
    setIcon(id: string, iconImage: mod.WorldIconImages): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconImage(icon, iconImage);
            state.icon = iconImage;
        }
    }

    /**
     * Update icon color and save state
     */
    setColor(id: string, color: mod.Vector): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconColor(icon, color);
            state.color = color;
        }
    }

    /**
     * Update icon text visibility and save state
     */
    setTextEnabled(id: string, enabled: boolean): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.EnableWorldIconText(icon, enabled);
            state.textEnabled = enabled;
        }
    }

    /**
     * Update icon image visibility and save state
     */
    setIconEnabled(id: string, enabled: boolean): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.EnableWorldIconImage(icon, enabled);
            state.iconEnabled = enabled;
        }
    }

    /**
     * Update both icon and text visibility together
     */
    setEnabled(id: string, iconEnabled: boolean, textEnabled: boolean): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.EnableWorldIconImage(icon, iconEnabled);
            mod.EnableWorldIconText(icon, textEnabled);
            state.iconEnabled = iconEnabled;
            state.textEnabled = textEnabled;
        }
    }

    /**
     * Update icon team owner and save state
     */
    setTeamOwner(id: string, team: mod.Team): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconOwner(icon, team);
            state.teamOwner = team;
            state.playerOwner = undefined; // Clear player owner
        }
    }

    /**
     * Update icon player owner and save state
     */
    setPlayerOwner(id: string, player: mod.Player): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconOwner(icon, player);
            state.playerOwner = player;
            state.teamOwner = undefined; // Clear team owner
        }
    }

    /**
     * Delete a specific icon
     */
    deleteIcon(id: string): void {
        const icon = this.icons.get(id);
        if (icon) {
            mod.UnspawnObject(icon);
            this.icons.delete(id);
            this.iconStates.delete(id);

            if (DEBUG_MODE) {
                console.log(`WorldIconManager: Deleted icon '${id}'`);
            }
        }
    }

    /**
     * Refresh a specific icon (disable and re-enable with saved state)
     * Called automatically on player join
     * Uses enable/disable approach similar to VFX system instead of unspawn/respawn
     */
    private refreshIcon(id: string): void {
        const state = this.iconStates.get(id);
        const icon = this.icons.get(id);

        if (!state || !icon) {
            if (DEBUG_MODE) {
                console.log(`WorldIconManager: Cannot refresh icon '${id}' - state=${!!state}, icon=${!!icon}`);
            }
            return;
        }

        // Step 1: Disable both icon and text
        mod.EnableWorldIconImage(icon, false);
        mod.EnableWorldIconText(icon, false);

        // Step 2: Reapply owner (team/player scope) if set
        if (state.teamOwner !== undefined) {
            mod.SetWorldIconOwner(icon, state.teamOwner);
        } else if (state.playerOwner !== undefined) {
            mod.SetWorldIconOwner(icon, state.playerOwner);
        }

        // Step 3: Reapply position
        mod.SetWorldIconPosition(icon, state.position);

        // Step 4: Reapply text properties
        if (state.text !== undefined) {
            mod.SetWorldIconText(icon, state.text);
        }

        // Step 5: Reapply icon properties
        if (state.icon !== undefined) {
            mod.SetWorldIconImage(icon, state.icon);
        }

        // Step 6: Reapply color
        if (state.color !== undefined) {
            mod.SetWorldIconColor(icon, state.color);
        }

        // Step 7: Re-enable with saved state
        mod.EnableWorldIconText(icon, state.textEnabled);
        mod.EnableWorldIconImage(icon, state.iconEnabled);

        if (DEBUG_MODE) {
            console.log(`WorldIconManager: Refreshed icon '${id}' (disable/enable approach)`);
        }
    }

    /**
     * Refresh all managed icons
     * Called when a player joins to fix visibility bugs
     */
    refreshAllIcons(): void {
        if (DEBUG_MODE) {
            console.log(`WorldIconManager: Refreshing ${this.iconStates.size} icons`);
        }

        for (const id of this.iconStates.keys()) {
            this.refreshIcon(id);
        }
    }

    /**
     * Delete all managed icons
     */
    deleteAllIcons(): void {
        for (const icon of this.icons.values()) {
            mod.UnspawnObject(icon);
        }
        this.icons.clear();
        this.iconStates.clear();

        if (DEBUG_MODE) {
            console.log('WorldIconManager: Deleted all icons');
        }
    }

    /**
     * Get count of managed icons
     */
    getIconCount(): number {
        return this.icons.size;
    }

    /**
     * Check if an icon exists
     */
    hasIcon(id: string): boolean {
        return this.icons.has(id);
    }
}


//==============================================================================================
// VFX MANAGER - Centralized management of ongoing VFX with refresh support
//==============================================================================================

/**
 * Type for runtime spawnable objects (VFX, SFX, etc.)
 */
type RuntimeSpawnType =
    | mod.RuntimeSpawn_Common
    | mod.RuntimeSpawn_Abbasid
    | mod.RuntimeSpawn_Aftermath
    | mod.RuntimeSpawn_Battery
    | mod.RuntimeSpawn_Capstone
    | mod.RuntimeSpawn_Dumbo
    | mod.RuntimeSpawn_FireStorm
    | mod.RuntimeSpawn_Limestone
    | mod.RuntimeSpawn_Outskirts
    | mod.RuntimeSpawn_Tungsten;

/**
 * Saved state for a VFX to enable refresh with same properties
 */
interface VFXState {
    id: string;
    vfxType: RuntimeSpawnType; // RuntimeSpawn VFX type for respawning if needed
    position: mod.Vector;
    rotation: mod.Vector;
    color?: mod.Vector;
    enabled: boolean;
    scale?: number;
}

/**
 * VFXManager - Manages all ongoing VFX effects in the game
 * Handles refresh on player first deploy by toggling VFX visibility
 *
 * Features:
 * - Automatic state tracking
 * - Toggle-based refresh (preserves particles)
 * - Centralized VFX lifecycle management
 * - Position, rotation, color, and scale tracking
 */
class VFXManager {
    private static instance: VFXManager;
    private vfxObjects: Map<string, mod.VFX> = new Map();
    private vfxStates: Map<string, VFXState> = new Map();

    private constructor() {
        if (DEBUG_MODE) {
            console.log('VFXManager: Initialized');
        }
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): VFXManager {
        if (!VFXManager.instance) {
            VFXManager.instance = new VFXManager();
        }
        return VFXManager.instance;
    }

    /**
     * Create and register a VFX effect
     * @param id Unique identifier for this VFX
     * @param vfxType RuntimeSpawn VFX type (e.g., mod.RuntimeSpawn_Common.FX_Smoke_Marker_Custom)
     * @param position World position
     * @param rotation World rotation (Euler angles as Vector)
     * @param options Optional configuration
     */
    createVFX(
        id: string,
        vfxType: RuntimeSpawnType,
        position: mod.Vector,
        rotation: mod.Vector,
        options?: {
            color?: mod.Vector;
            enabled?: boolean;
            scale?: number;
        }
    ): mod.VFX {
        // Delete existing VFX if it exists
        if (this.vfxObjects.has(id)) {
            this.deleteVFX(id);
        }

        // Spawn the VFX
        const vfx = mod.SpawnObject(vfxType, position, rotation) as mod.VFX;

        // Apply color if specified
        if (options?.color !== undefined) {
            mod.SetVFXColor(vfx, options.color);
        }

        // Apply scale if specified
        if (options?.scale !== undefined) {
            mod.SetVFXScale(vfx, options.scale);
        }

        // Apply enabled state (default to true)
        const enabled = options?.enabled ?? true;
        mod.EnableVFX(vfx, enabled);

        // Save state
        const state: VFXState = {
            id: id,
            vfxType: vfxType,
            position: position,
            rotation: rotation,
            color: options?.color,
            enabled: enabled,
            scale: options?.scale
        };

        this.vfxObjects.set(id, vfx);
        this.vfxStates.set(id, state);

        if (DEBUG_MODE) {
            console.log(`VFXManager: Created VFX '${id}'`);
        }

        return vfx;
    }

    /**
     * Get a managed VFX by ID
     */
    getVFX(id: string): mod.VFX | undefined {
        return this.vfxObjects.get(id);
    }

    /**
     * Update VFX position and rotation, and save state
     */
    setPosition(id: string, position: mod.Vector, rotation: mod.Vector): void {
        const vfx = this.vfxObjects.get(id);
        const state = this.vfxStates.get(id);

        if (vfx && state) {
            mod.MoveVFX(vfx, position, rotation);
            state.position = position;
            state.rotation = rotation;
        }
    }

    /**
     * Update VFX color and save state
     */
    setColor(id: string, color: mod.Vector): void {
        const vfx = this.vfxObjects.get(id);
        const state = this.vfxStates.get(id);

        if (vfx && state) {
            mod.SetVFXColor(vfx, color);
            state.color = color;
        }
    }

    /**
     * Update VFX enabled state and save state
     */
    setEnabled(id: string, enabled: boolean): void {
        const vfx = this.vfxObjects.get(id);
        const state = this.vfxStates.get(id);

        if (vfx && state) {
            mod.EnableVFX(vfx, enabled);
            state.enabled = enabled;
        }
    }

    /**
     * Update VFX scale and save state
     */
    setScale(id: string, scale: number): void {
        const vfx = this.vfxObjects.get(id);
        const state = this.vfxStates.get(id);

        if (vfx && state) {
            mod.SetVFXScale(vfx, scale);
            state.scale = scale;
        }
    }

    /**
     * Delete a specific VFX
     */
    deleteVFX(id: string): void {
        const vfx = this.vfxObjects.get(id);
        if (vfx) {
            mod.UnspawnObject(vfx);
            this.vfxObjects.delete(id);
            this.vfxStates.delete(id);

            if (DEBUG_MODE) {
                console.log(`VFXManager: Deleted VFX '${id}'`);
            }
        }
    }

    /**
     * Refresh a specific VFX using toggle method
     * Disables then re-enables to force visibility update without destroying particles
     */
    private refreshVFX(id: string): void {
        const vfx = this.vfxObjects.get(id);
        const state = this.vfxStates.get(id);

        if (!vfx || !state) return;

        // Toggle method: disable then re-enable with saved state
        // This should preserve particle state while forcing visibility refresh
        mod.EnableVFX(vfx, false);
        mod.EnableVFX(vfx, state.enabled);

        if (DEBUG_MODE) {
            console.log(`VFXManager: Refreshed VFX '${id}' (toggled ${state.enabled ? 'on' : 'off'})`);
        }
    }

    /**
     * Refresh all managed VFX effects
     * Called when a player deploys for the first time to fix visibility bugs
     */
    refreshAllVFX(): void {
        if (DEBUG_MODE) {
            console.log(`VFXManager: Refreshing ${this.vfxStates.size} VFX effects`);
        }

        for (const id of this.vfxStates.keys()) {
            this.refreshVFX(id);
        }
    }

    /**
     * Delete all managed VFX
     */
    deleteAllVFX(): void {
        for (const vfx of this.vfxObjects.values()) {
            mod.UnspawnObject(vfx);
        }
        this.vfxObjects.clear();
        this.vfxStates.clear();

        if (DEBUG_MODE) {
            console.log('VFXManager: Deleted all VFX');
        }
    }

    /**
     * Get count of managed VFX
     */
    getVFXCount(): number {
        return this.vfxObjects.size;
    }

    /**
     * Check if a VFX exists
     */
    hasVFX(id: string): boolean {
        return this.vfxObjects.has(id);
    }
}


//==============================================================================================
// BASE SCORE HUD
//==============================================================================================

interface BaseScoreboardHUD {
    readonly player: mod.Player;
    readonly playerId: number;
    readonly rootWidget: mod.UIWidget | undefined;

    create(): void;
    refresh(): void;
    close(): void;
    isOpen(): boolean;
}

//==============================================================================================
// TICKER WIDGET BASE CLASS - Base class for UI widgets with position, text, background, and brackets
//==============================================================================================

import { ParseUI } from "modlib";

interface TickerWidgetParams {
    position: number[];
    size: number[];
    parent: mod.UIWidget;
    textSize?: number;
    bracketTopBottomLength?: number;
    bracketThickness?: number;
    bgColor?: mod.Vector;
    textColor?: mod.Vector;
    bgAlpha?: number;
    showProgressBar?: boolean;
    progressValue?: number;
    progressDirection?: 'left' | 'right';
}

abstract class TickerWidget {
    readonly parent: mod.UIWidget;
    readonly position: number[];
    readonly size: number[];
    readonly textSize: number;
    readonly bracketTopBottomLength: number;
    readonly bracketThickness: number;
    protected bgColor: mod.Vector;
    protected textColor: mod.Vector;
    protected bgAlpha: number;
    
    // Main widgets
    protected columnWidget!: mod.UIWidget;
    protected columnWidgetOutline!: mod.UIWidget;
    protected textWidget!: mod.UIWidget;
    protected pulseGradientWidget!: mod.UIWidget;
    
    // Progress bar
    protected progressBarContainer: mod.UIWidget | undefined;
    protected progressValue: number;
    protected progressDirection: 'left' | 'right';
    protected showProgressBar: boolean;
    
    // Leading indicator brackets (left side)
    protected leftBracketSide: mod.UIWidget | undefined;
    protected leftBracketTop: mod.UIWidget | undefined;
    protected leftBracketBottom: mod.UIWidget | undefined;
    
    // Leading indicator brackets (right side)
    protected rightBracketSide: mod.UIWidget | undefined;
    protected rightBracketTop: mod.UIWidget | undefined;
    protected rightBracketBottom: mod.UIWidget | undefined;

    // Animation
    isPulsing = false;
    
    constructor(params: TickerWidgetParams) {
        this.parent = params.parent;
        this.position = params.position ?? [0, 0];
        this.size = params.size ?? [0, 0];
        this.textSize = params.textSize ?? 30;
        this.bracketTopBottomLength = params.bracketTopBottomLength ?? 8;
        this.bracketThickness = params.bracketThickness ?? 2;
        this.bgColor = params.bgColor ?? mod.CreateVector(0.5, 0.5, 0.5);
        this.textColor = params.textColor ?? mod.CreateVector(1, 1, 1);
        this.bgAlpha = params.bgAlpha ?? 0.75;
        this.showProgressBar = params.showProgressBar ?? false;
        this.progressValue = params.progressValue ?? 1.0;
        this.progressDirection = params.progressDirection ?? 'left';
        
        this.createWidgets();
    }
    
    /**
     * Create all UI widgets for the ticker
     */
    protected createWidgets(): void {
        // Create column container with background color
        this.columnWidget = modlib.ParseUI({
            type: "Container",
            parent: this.parent,
            position: this.position,
            size: [this.size[0], this.size[1]],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: this.bgColor,
            bgAlpha: this.bgAlpha
        })!;

        // Create column container with outline
        this.columnWidgetOutline = modlib.ParseUI({
            type: "Container",
            parent: this.parent,
            position: this.position,
            size: [this.size[0], this.size[1]],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.OutlineThin,
            bgColor: this.textColor,
            bgAlpha: 0
        })!;
        
        // Create text widget
        this.createTextWidget();
        
        // Create progress bar if enabled
        if (this.showProgressBar) {
            this.createProgressBar();
        }

        // Create gradient pulse effect
        this.pulseGradientWidget = ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [0, this.size[1]],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.GradientRight,
            bgColor: this.textColor,
            bgAlpha: 0.6
        })!;
        
        // Create leading indicator brackets
        this.createBrackets();
    }
    
    /**
     * Create the text widget - can be overridden by subclasses for custom styling
     */
    protected createTextWidget(): void {
        this.textWidget = modlib.ParseUI({
            type: "Text",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.size[0], 25],
            anchor: mod.UIAnchor.Center,
            textAnchor: mod.UIAnchor.Center,
            textSize: this.textSize,
            textLabel: mod.stringkeys.empty_string,
            textColor: this.textColor,
            bgAlpha: 0,
        })!;
    }
    
    /**
     * Create progress bar container
     */
    protected createProgressBar(): void {
        const progressWidth = this.size[0] * this.progressValue;
        const anchor = this.progressDirection === 'left' ? mod.UIAnchor.CenterLeft : mod.UIAnchor.CenterRight;
        
        this.progressBarContainer = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [progressWidth, this.size[1]],
            anchor: anchor,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 0.9
        })!;
    }
    
    /**
     * Set the progress bar value (0.0 to 1.0)
     */
    public setProgressValue(value: number): void {
        this.progressValue = Math.max(0, Math.min(1, value));
        
        if (this.progressBarContainer) {
            const progressWidth = this.size[0] * this.progressValue;
            mod.SetUIWidgetSize(this.progressBarContainer, mod.CreateVector(progressWidth, this.size[1], 0));
        }
    }
    
    /**
     * Set the progress bar fill direction
     */
    public setProgressDirection(direction: 'left' | 'right'): void {
        this.progressDirection = direction;
        
        if (this.progressBarContainer) {
            const anchor = direction === 'left' ? mod.UIAnchor.CenterLeft : mod.UIAnchor.CenterRight;
            mod.SetUIWidgetAnchor(this.progressBarContainer, anchor);
        }
    }
    
    /**
     * Get the progress bar value
     */
    public getProgressValue(): number {
        return this.progressValue;
    }
    
    /**
     * Create bracket indicators for highlighting
     * Brackets form open/close square bracket shapes on each side
     */
    protected createBrackets(): void {
        // LEFT BRACKETS (opening bracket [)
        // Left side vertical bar
        this.leftBracketSide = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketThickness, this.size[1]],
            anchor: mod.UIAnchor.CenterLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // Left top horizontal bar
        this.leftBracketTop = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketTopBottomLength, this.bracketThickness],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // Left bottom horizontal bar
        this.leftBracketBottom = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketTopBottomLength, this.bracketThickness],
            anchor: mod.UIAnchor.BottomLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // RIGHT BRACKETS (closing bracket ])
        // Right side vertical bar
        this.rightBracketSide = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketThickness, this.size[1]],
            anchor: mod.UIAnchor.CenterRight,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // Right top horizontal bar
        this.rightBracketTop = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketTopBottomLength, this.bracketThickness],
            anchor: mod.UIAnchor.TopRight,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // Right bottom horizontal bar
        this.rightBracketBottom = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketTopBottomLength, this.bracketThickness],
            anchor: mod.UIAnchor.BottomRight,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // Hide brackets by default
        this.showBrackets(false);
    }
    
    /**
     * Update the text displayed in the widget
     */
    protected updateText(message: mod.Message): void {
        mod.SetUITextLabel(this.textWidget, message);
    }
    
    /**
     * Show or hide the bracket indicators
     */
    protected showBrackets(show: boolean): void {
        if (this.leftBracketTop) mod.SetUIWidgetVisible(this.leftBracketTop, show);
        if (this.leftBracketSide) mod.SetUIWidgetVisible(this.leftBracketSide, show);
        if (this.leftBracketBottom) mod.SetUIWidgetVisible(this.leftBracketBottom, show);
        if (this.rightBracketSide) mod.SetUIWidgetVisible(this.rightBracketSide, show);
        if (this.rightBracketTop) mod.SetUIWidgetVisible(this.rightBracketTop, show);
        if (this.rightBracketBottom) mod.SetUIWidgetVisible(this.rightBracketBottom, show);
    }

    
    async StartThrob(pulseSpeed?: number, minimumAlpha?: number, maximumAlpha?: number): Promise<void> {
        if(this.isPulsing)
            return;

        let minAlpha = minimumAlpha ?? 0;
        let maxAlpha = maximumAlpha ?? 1;
        let speed = pulseSpeed ?? 0.1;

        this.isPulsing = true;
        let time = 0;
        while(this.isPulsing){
            time = GetCurrentTime();
            let blinkActive = Math.round(Math2.TriangleWave(time, 1, 1)) > 0;
            this.showBrackets(blinkActive);
            await mod.Wait(TICK_RATE);
        }
    }

    StopThrob(): void {
        this.isPulsing = false;
    }

    async pulse(reverse?: boolean): Promise<void> {
        if(this.isPulsing)
            return;

        // Set start state
        this.isPulsing = true;
        let startSizeVec = mod.GetUIWidgetSize(this.columnWidget);
        let startSize: number[] = this.size;
        let startPosition: number[] = [0,0];

        // Configure gradient direction and anchor based on reverse parameter
        if (reverse) {
            // Right-to-left: Use left gradient anchored to the right
            mod.SetUIWidgetBgFill(this.pulseGradientWidget, mod.UIBgFill.GradientLeft);
            mod.SetUIWidgetAnchor(this.pulseGradientWidget, mod.UIAnchor.TopRight);
        } else {
            // Left-to-right: Use right gradient anchored to the left
            mod.SetUIWidgetBgFill(this.pulseGradientWidget, mod.UIBgFill.GradientRight);
            mod.SetUIWidgetAnchor(this.pulseGradientWidget, mod.UIAnchor.TopLeft);
        }

        mod.SetUIWidgetSize(this.pulseGradientWidget, mod.CreateVector(5, startSize[1], 0));
        mod.SetUIWidgetPosition(this.pulseGradientWidget, mod.CreateVector(startPosition[0], startPosition[1], 0));

        // Scale up gradient wipe
        await animationManager.AnimateValue(0, startSize[0], {
            duration: 0.25,
            easingFunction: Easing.EaseInSine,
            onProgress: (value, normalizedTime) => {
                mod.SetUIWidgetPosition(this.pulseGradientWidget, ZERO_VEC);
                mod.SetUIWidgetSize(this.pulseGradientWidget, mod.CreateVector(value, startSize[1], 0));
            },
        }).then(async ()=>{
            await animationManager.AnimateValue(0, startSize[0],
            {
                duration: 0.25,
                easingFunction: Easing.EaseOutSine,
                onProgress: (value, normalizedTime) => {
                    if (reverse) {
                        // Right-to-left: Move left and shrink
                        mod.SetUIWidgetPosition(this.pulseGradientWidget, mod.CreateVector(value - 4, 0, 0));
                    } else {
                        // Left-to-right: Move right and shrink
                        mod.SetUIWidgetPosition(this.pulseGradientWidget, mod.CreateVector(value - 4, 0, 0));
                    }
                    mod.SetUIWidgetSize(this.pulseGradientWidget, mod.CreateVector(startSize[0] - value, startSize[1], 0));
                },
            });
            
            this.isPulsing = false;
        });
    }

    /**
     * Destroy all UI widgets created by this ticker
     * Should be called before discarding the ticker instance
     */
    public destroy(): void {
        // Delete all bracket widgets
        if (this.leftBracketTop) mod.DeleteUIWidget(this.leftBracketTop);
        if (this.leftBracketSide) mod.DeleteUIWidget(this.leftBracketSide);
        if (this.leftBracketBottom) mod.DeleteUIWidget(this.leftBracketBottom);
        if (this.rightBracketTop) mod.DeleteUIWidget(this.rightBracketTop);
        if (this.rightBracketSide) mod.DeleteUIWidget(this.rightBracketSide);
        if (this.rightBracketBottom) mod.DeleteUIWidget(this.rightBracketBottom);

        // Delete progress bar
        if (this.progressBarContainer) mod.DeleteUIWidget(this.progressBarContainer);

        // Delete text widget
        if (this.textWidget) mod.DeleteUIWidget(this.textWidget);

        // Delete outline and main container
        if (this.columnWidgetOutline) mod.DeleteUIWidget(this.columnWidgetOutline);
        if (this.columnWidget) mod.DeleteUIWidget(this.columnWidget);
    }

    /**
     * Refresh the widget - should be implemented by subclasses
     */
    abstract refresh(): void;
}


//==============================================================================================
// SCORE TICKER - Modular team score display widget
//==============================================================================================

interface ScoreTickerParams {
    team: mod.Team;
    position: number[];
    size: number[];
    parent: mod.UIWidget;
    textSize?: number;
    bracketTopBottomLength?: number;
    bracketThickness?: number;
    reversePulse?: boolean
}

class ScoreTicker extends TickerWidget {
    readonly team: mod.Team;
    readonly teamId: number;
    
    private currentScore: number = -1;
    private isLeading: boolean = false;
    private reversePulse: boolean = false;
    
    constructor(params: ScoreTickerParams) {
        // Get team colors before calling super
        const teamId = mod.GetObjId(params.team);
        const teamColor = GetTeamColorDark(params.team);
        const textColor = GetTeamColorLight(params.team);
        
        // Call parent constructor with team-specific colors
        super({
            position: params.position,
            size: params.size,
            parent: params.parent,
            textSize: params.textSize,
            bracketTopBottomLength: params.bracketTopBottomLength,
            bracketThickness: params.bracketThickness,
            bgColor: teamColor,
            textColor: textColor,
            bgAlpha: 0.75
        });
        
        this.team = params.team;
        this.teamId = teamId;
        this.reversePulse = params.reversePulse ?? false;
        this.refresh();
    }
    
    /**
     * Update the score display and leading indicator
     */
    public updateScore(): void {
        const score = teamScores.get(this.teamId) ?? 0;
        
        // Only update if score has changed
        if (this.currentScore !== score) {
            this.currentScore = score;

            let pulseAndUpdateText = async () => {
                this.pulse(this.reversePulse);

                // Wait until pulse reaches text widget
                await mod.Wait(0.1625);
                this.updateText(mod.Message(score));

                // Set the text colour to white and fade back down
                let textColor: number[] = [mod.XComponentOf(this.textColor), mod.YComponentOf(this.textColor), mod.ZComponentOf(this.textColor)];
                await animationManager.AnimateValues([1, 1, 1], textColor, {
                    duration: 0.3,
                    easingFunction: Easing.EaseOutCubic,
                    onProgress: (values, normalizedTime) => {
                        mod.SetUITextColor(this.textWidget,  mod.CreateVector(values[0], values[1], values[2]));
                    }
                });
            };
            pulseAndUpdateText();

            // Show brackets only if this team is the sole leader (no ties)
            let leadingTeams = GetLeadingTeamIDs();
            console.log(`Leading teams: ${leadingTeams.join(", ")}`);
            if(leadingTeams.length === 1 && leadingTeams.includes(this.teamId)){
                this.setLeading(true);
            } else {
                this.setLeading(true);
            }
        }
    }
    
    /**
     * Set whether this team is currently in the lead
     * @param isLeading True if this team is leading (not tied)
     */
    public setLeading(isLeading: boolean): void {
        console.log(`Score ticker leading: ${isLeading}`);
        
        this.isLeading = isLeading;
        this.showBrackets(isLeading);
    }
    
    /**
     * Get the current score
     */
    public getScore(): number {
        return this.currentScore;
    }
    
    /**
     * Get the team ID
     */
    public getTeamId(): number {
        return this.teamId;
    }
    
    /**
     * Refresh both score and leading status
     */
    public refresh(): void {
        this.updateScore();
    }

    /**
     * Destroy all UI widgets created by this score ticker
     */
    public destroy(): void {
        super.destroy();
    }
}


//==============================================================================================
// ROUND TIMER - Display remaining game time in mm:ss format
//==============================================================================================

interface RoundTimerParams {
    position: number[];
    size: number[];
    parent: mod.UIWidget;
    textSize?: number;
    seperatorPadding?: number;
    bracketTopBottomLength?: number;
    bracketThickness?: number;
    bgColor?: mod.Vector;
    textColor?: mod.Vector;
    bgAlpha?: number;

}

class RoundTimer extends TickerWidget {
    private currentTimeSeconds: number = -1;
    private currentTimeMinutes: number = -1;
    private seperatorPadding: number;
    private secondsText: mod.UIWidget;
    private minutesText: mod.UIWidget;
    private seperatorText: mod.UIWidget;
    
    constructor(params: RoundTimerParams) {        
        // Call parent constructor with default neutral colors if not specified
        super({
            position: params.position,
            size: params.size,
            parent: params.parent,
            textSize: params.textSize,
            bracketTopBottomLength: params.bracketTopBottomLength,
            bracketThickness: params.bracketThickness,
            bgColor: params.bgColor ?? mod.CreateVector(0.2, 0.2, 0.2),
            textColor: params.textColor ?? mod.CreateVector(1, 1, 1),
            bgAlpha: params.bgAlpha ?? 0.75
        });

        this.seperatorPadding = params.seperatorPadding ?? 16;

        this.secondsText = modlib.ParseUI({
            type: "Text",
            parent: this.columnWidget,
            position: [this.seperatorPadding, 0],
            size: [30, 24],
            anchor: mod.UIAnchor.Center,
            textAnchor: mod.UIAnchor.CenterLeft,
            textSize: this.textSize,
            textLabel: "",
            textColor: this.textColor,
            bgAlpha: 0,
        })!;

        this.minutesText = modlib.ParseUI({
            type: "Text",
            parent: this.columnWidget,
            position: [-this.seperatorPadding, 0],
            size: [5, 24],
            anchor: mod.UIAnchor.Center,
            textAnchor: mod.UIAnchor.CenterRight,
            textSize: this.textSize,
            textLabel: "",
            textColor: this.textColor,
            bgAlpha: 0,
        })!;

        this.seperatorText = modlib.ParseUI({
            type: "Text",
            parent: this.columnWidget,
            position: [0, 0],
            size: [30, 24],
            anchor: mod.UIAnchor.Center,
            textAnchor: mod.UIAnchor.Center,
            textSize: this.textSize,
            textLabel: mod.stringkeys.score_timer_seperator,
            textColor: this.textColor,
            bgAlpha: 0,
        })!;
        
        this.refresh();
    }
    
    /**
     * Update the timer display with remaining game time
     */
    public updateTime(): void {
        const remainingTime = mod.GetMatchTimeRemaining();
        const timeSeconds = Math.floor(remainingTime);
        
        // Only update if time has changed
        if (this.currentTimeSeconds !== timeSeconds) {

            // Update time values and floor/pad values
            this.currentTimeSeconds = timeSeconds % 60;
            this.currentTimeMinutes = Math.floor(timeSeconds / 60);
            const secondsTensDigit = Math.floor(this.currentTimeSeconds / 10);
            const secondsOnesDigit = this.currentTimeSeconds % 10;

            // Update text labels
            mod.SetUITextLabel(this.minutesText, mod.Message(mod.stringkeys.score_timer_minutes, this.currentTimeMinutes));
            mod.SetUITextLabel(this.secondsText, mod.Message(mod.stringkeys.score_timer_seconds, secondsTensDigit, secondsOnesDigit));
        }
    }
    
    /**
     * Refresh the timer display
     */
    public refresh(): void {
        this.updateTime();
    }

    /**
     * Destroy all UI widgets created by this timer
     */
    public destroy(): void {
        // Delete timer-specific widgets
        if (this.secondsText) mod.DeleteUIWidget(this.secondsText);
        if (this.minutesText) mod.DeleteUIWidget(this.minutesText);
        if (this.seperatorText) mod.DeleteUIWidget(this.seperatorText);

        // Call parent destroy for base ticker widgets
        super.destroy();
    }
}


//==============================================================================================
// FLAG BAR UI CLASS - Displays flag positions and progress for two teams
//==============================================================================================

interface FlagBarParams {
    position: number[];
    size: number[];  // [width, height]
    parent: mod.UIWidget;
    team1: mod.Team;
    team2: mod.Team;
    team1CaptureZonePosition: mod.Vector;
    team2CaptureZonePosition: mod.Vector;
    barHeight?: number;  // Default: 16
    barSeperatorPadding?: number;
    flagIconSize?: number[];  // Default: [24, 24]
}

interface FlagBarState {
    targetProgress: number;   // Target position (0-1)
    currentProgress: number;  // Current animated position (0-1)
    velocity: number;         // For smooth dampening
}

class FlagBar {
    private readonly params: FlagBarParams;
    private rootContainer: mod.UIWidget;

    // Team bars (TickerWidget containers)
    private team1Bar: TickerWidget;
    private team2Bar: TickerWidget;

    // Flag icons
    private team1FlagIcon: FlagIcon;
    private team2FlagIcon: FlagIcon;

    // Flag states for smooth animation
    private team1FlagState: FlagBarState;
    private team2FlagState: FlagBarState;

    // Teams
    private readonly team1: mod.Team;
    private readonly team2: mod.Team;
    private readonly team1Id: number;
    private readonly team2Id: number;

    // Dimensions
    private readonly barWidth: number;
    private readonly barHeight: number;
    private readonly halfBarWidth: number;
    private readonly flagIconSize: number[];
    private readonly barSeperatorSize: number;

    // Event subscriptions
    private eventUnsubscribers: (() => void)[] = [];

    constructor(params: FlagBarParams) {
        this.params = params;
        this.team1 = params.team1;
        this.team2 = params.team2;
        this.team1Id = mod.GetObjId(this.team1);
        this.team2Id = mod.GetObjId(this.team2);
        this.barSeperatorSize = this.params.barSeperatorPadding ?? 24;
        this.barWidth = params.size[0] - this.barSeperatorSize;
        this.barHeight = params.barHeight ?? 16;
        this.halfBarWidth = this.barWidth / 2;
        this.flagIconSize = params.flagIconSize ?? [24, 24];

        // Initialize flag states
        this.team1FlagState = {
            targetProgress: 0.0,
            currentProgress: 0.0,
            velocity: 0.0
        };

        this.team2FlagState = {
            targetProgress: 0.0,
            currentProgress: 0.0,
            velocity: 0.0
        };

        // Create root container
        this.rootContainer = this.createRootContainer();

        // Create team bars
        this.team1Bar = this.createTeamBar(this.team1, true);
        this.team2Bar = this.createTeamBar(this.team2, false);

        // Create flag icons
        this.team1FlagIcon = this.createFlagIcon(this.team1, this.team1Id);
        this.team2FlagIcon = this.createFlagIcon(this.team2, this.team2Id);

        // Subscribe to flag events
        this.bindFlagEvents();
    }

    /**
     * Subscribe to flag events for visual feedback
     */
    private bindFlagEvents(): void {
        // Create array of flag/icon pairs to avoid duplication
        const flagPairs = [
            { flag: flags.get(this.team1Id), icon: this.team1FlagIcon },
            { flag: flags.get(this.team2Id), icon: this.team2FlagIcon }
        ];

        for (const { flag, icon } of flagPairs) {
            if (!flag) continue;

            // Flag picked up - stop throb, solid appearance
            const unsubTaken = flag.events.on('flagTaken', (data) => {
                if (icon.isPulsing) {
                    icon.StopThrob();
                }
                icon.SetFillAlpha(1);
            });
            this.eventUnsubscribers.push(unsubTaken);

            // Flag dropped - start throb effect
            const unsubDropped = flag.events.on('flagDropped', () => {
                if (!icon.isPulsing) {
                    icon.StartThrob(1, 0.1, 0.8);
                }
            });
            this.eventUnsubscribers.push(unsubDropped);

            // Flag returned - stop throb, solid appearance
            const unsubReturned = flag.events.on('flagReturned', () => {
                if (icon.isPulsing) {
                    icon.StopThrob();
                }
                icon.SetFillAlpha(1);
            });
            this.eventUnsubscribers.push(unsubReturned);
        }
    }
    
    private createRootContainer(): mod.UIWidget {
        return modlib.ParseUI({
            type: "Container",
            parent: this.params.parent,
            position: this.params.position,
            size: [this.barWidth, this.barHeight],
            anchor: mod.UIAnchor.TopCenter,
            bgAlpha: 0  // Transparent background
        })!;
    }
    
    private createTeamBar(team: mod.Team, isLeftSide: boolean): TickerWidget {
        const teamId = mod.GetObjId(team);
        const teamColor = GetTeamColorById(teamId);
        
        // Position bars side by side
        const xPos = isLeftSide ? (-this.halfBarWidth / 2) - this.barSeperatorSize : (this.halfBarWidth / 2) + this.barSeperatorSize;
        
        // Create a simple TickerWidget subclass for the bar
        class FlagBarTicker extends TickerWidget {
            refresh(): void {
                // No refresh needed for flag bars
            }
        }

        const textColor = GetTeamColorLight(team);
        const midColor = VectorClampToRange(
            Math2.Vec3.FromVector(teamColor).Add(new Math2.Vec3(0.15, 0.15, 0.15)).ToVector(),
            0, 
            1
        );
        return new FlagBarTicker({
            position: [xPos, 0],
            size: [this.halfBarWidth, this.barHeight],
            parent: this.rootContainer,
            textSize: 0,  // No text
            textColor: midColor,
            bgColor: teamColor,
            bgAlpha: 0.5,
            showProgressBar: true,
            progressValue: 1.0,  // Start full
            progressDirection: isLeftSide ? 'right' : 'left'
        });
    }
    
    private createFlagIcon(team: mod.Team, teamId: number): FlagIcon {
        const teamColor = GetTeamColorById(teamId);
        const textColor = GetTeamColorLight(team);
        
        return new FlagIcon({
            name: `FlagBar_FlagIcon_Team${teamId}`,
            position: mod.CreateVector(0, 0, 0),
            size: mod.CreateVector(this.flagIconSize[0], this.flagIconSize[1], 0),
            anchor: mod.UIAnchor.Center,
            parent: this.rootContainer,
            bgFill: mod.UIBgFill.Solid,
            fillColor: textColor,
            fillAlpha: 1,
            outlineColor: textColor,
            outlineThickness: 1,
            showFill: true,
            showOutline: false,
            visible: true
        });
    }
    
    /**
     * Main update method - called from ClassicCTFScoreHUD refresh (1Hz SlowUpdate)
     */
    public update(flags: Map<number, Flag>, deltaTime: number = 1.0): void {
        // Get flags for each team
        const team1Flag = flags.get(this.team1Id);
        const team2Flag = flags.get(this.team2Id);
        
        if (team1Flag) {
            this.updateFlagState(
                team1Flag,
                this.team1FlagState,
                this.team1FlagIcon,
                this.team1Bar,
                this.params.team2CaptureZonePosition,
                true,
                deltaTime
            );
        }
        
        if (team2Flag) {
            this.updateFlagState(
                team2Flag,
                this.team2FlagState,
                this.team2FlagIcon,
                this.team2Bar,
                this.params.team1CaptureZonePosition,
                false,
                deltaTime
            );
        }
    }
    
    /**
     * Update a single flag's state and position
     */
    private updateFlagState(
        flag: Flag,
        flagState: FlagBarState,
        flagIcon: FlagIcon,
        opposingBar: TickerWidget,
        captureZonePosition: mod.Vector,
        isLeftTeam: boolean,
        deltaTime: number
    ): void {
        // Calculate target progress
        flagState.targetProgress = this.calculateFlagProgress(flag, captureZonePosition);

        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Team ${flag.teamId} flag state: isAtHome=${flag.isAtHome}, isCarried=${flag.isBeingCarried}, isDropped=${flag.isDropped}`);
            //console.log(`[FlagBar] Team ${flag.teamId} targetProgress: ${flagState.targetProgress.toFixed(3)}`);
        }

        // Apply smooth damping
        this.smoothDampProgress(flagState, deltaTime);

        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Team ${flag.teamId} currentProgress after damping: ${flagState.currentProgress.toFixed(3)}`);
        }

        // Update flag icon position
        this.updateFlagIconPosition(flagIcon, flagState.currentProgress, isLeftTeam);

        // Flag visual effects (throb, alpha) are now handled by event subscriptions

        // Update bar progress (bar empties as flag advances).
        // Bar at twice the distance of the flag process so we empty it at the moment the flag hits the middle
        const barProgress = 1.0 - flagState.currentProgress * 2;
        opposingBar.setProgressValue(barProgress);

        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Team ${flag.teamId} opposing bar progress: ${barProgress.toFixed(3)}`);
        }
    }
    
    /**
     * Calculate flag progress from home (0.0) to enemy capture zone (1.0)
     * Uses vector projection to ensure progress only increases when moving toward capture zone
     */
    private calculateFlagProgress(flag: Flag, captureZonePosition: mod.Vector): number {
        if (flag.isAtHome) {
            //if (DEBUG_MODE) console.log(`[FlagBar] Flag ${flag.teamId} is at home, progress = 0.0`);
            return 0.0;
        }
        
        const homePos = flag.homePosition;
        const currentPos = flag.currentPosition;
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Flag ${flag.teamId} homePos: ${VectorToString(homePos)}`);
            //console.log(`[FlagBar] Flag ${flag.teamId} currentPos: ${VectorToString(currentPos)}`);
            //console.log(`[FlagBar] Flag ${flag.teamId} captureZonePos: ${VectorToString(captureZonePosition)}`);
        }
        
        // Vector from home to capture zone (the direction we want to measure progress along)
        const homeToCaptureVec = Math2.Vec3.FromVector(captureZonePosition)
            .Subtract(Math2.Vec3.FromVector(homePos));
        
        // Vector from home to current position
        const homeToCurrentVec = Math2.Vec3.FromVector(currentPos)
            .Subtract(Math2.Vec3.FromVector(homePos));
        
        // Calculate the total distance from home to capture zone using proper vector length
        const totalDistanceSquared = (homeToCaptureVec.x * homeToCaptureVec.x) +
                                    (homeToCaptureVec.y * homeToCaptureVec.y) +
                                    (homeToCaptureVec.z * homeToCaptureVec.z);
        
        const totalDistance = Math.sqrt(totalDistanceSquared);
        
        if (totalDistance < 0.01) {
            // Capture zone is at the same position as home (edge case)
            //if (DEBUG_MODE) console.log(`[FlagBar] Flag ${flag.teamId} capture zone at home position, progress = 0.0`);
            return 0.0;
        }
        
        // Project current position onto the home-to-capture line
        // This gives us the distance along the line toward the capture zone
        const dotProduct = (homeToCurrentVec.x * homeToCaptureVec.x) +
                          (homeToCurrentVec.y * homeToCaptureVec.y) +
                          (homeToCurrentVec.z * homeToCaptureVec.z);
        
        const projectedDistance = dotProduct / totalDistance;
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Flag ${flag.teamId} totalDistance: ${totalDistance.toFixed(2)}`);
            //console.log(`[FlagBar] Flag ${flag.teamId} dotProduct: ${dotProduct.toFixed(2)}`);
            //console.log(`[FlagBar] Flag ${flag.teamId} projectedDistance: ${projectedDistance.toFixed(2)}`);
        }
        
        // Normalize progress to [0, 1] range
        // - If projectedDistance < 0, flag is behind home (moving away), clamp to 0
        // - If projectedDistance > totalDistance, flag is past capture zone, clamp to 1
        const progress = Math.max(0.0, Math.min(1.0, projectedDistance / totalDistance));
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Flag ${flag.teamId} calculated progress: ${progress.toFixed(3)}`);
        }
        
        return progress;
    }
    
    /**
     * Apply smooth damping to progress for smooth animation
     * Uses a damped spring algorithm with 2 second smooth time
     */
    private smoothDampProgress(flagState: FlagBarState, deltaTime: number): void {
        const smoothTime = 2.0;  // 2 seconds to reach target
        
        // Damped spring calculation
        const omega = 2.0 / smoothTime;
        const x = omega * deltaTime;
        const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
        
        const change = flagState.currentProgress - flagState.targetProgress;
        const temp = (flagState.velocity + omega * change) * deltaTime;
        
        flagState.velocity = (flagState.velocity - omega * temp) * exp;
        flagState.currentProgress = flagState.targetProgress + (change + temp) * exp;
        
        // Clamp to valid range
        flagState.currentProgress = Math.max(0.0, Math.min(1.0, flagState.currentProgress));
    }
    
    /**
     * Update flag icon position based on progress
     * Progress 0.0: Flag at far end of own bar
     * Progress 0.5: Flag at center (between bars)
     * Progress 1.0: Flag at far end of enemy bar
     */
    private updateFlagIconPosition(
        flagIcon: FlagIcon,
        progress: number,
        isLeftTeam: boolean
    ): void {
        // Calculate position across the entire bar width
        // For left team: 0.0 progress = left edge, 1.0 progress = right edge
        // For right team: 0.0 progress = right edge, 1.0 progress = left edge
        
        let xPos: number;
        
        if (isLeftTeam) {
            // Left team flag moves from left (-halfBarWidth) to right (+halfBarWidth)
            xPos = -this.halfBarWidth + (this.flagIconSize[0] * 0.5) - this.barSeperatorSize + (progress * this.barWidth);
        } else {
            // Right team flag moves from right (+halfBarWidth) to left (-halfBarWidth)
            xPos = this.halfBarWidth - (this.flagIconSize[0] * 0.5) + this.barSeperatorSize - (progress * this.barWidth);
        }
        
        // Center vertically
        const yPos = 3;
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] ${isLeftTeam ? 'Left' : 'Right'} team flag position: x=${xPos.toFixed(2)}, y=${yPos}, progress=${progress.toFixed(3)}`);
            //console.log(`[FlagBar] Bar dimensions: halfBarWidth=${this.halfBarWidth.toFixed(2)}, barWidth=${this.barWidth.toFixed(2)}`);
        }
        
        flagIcon.SetPosition(mod.CreateVector(xPos, yPos, 0));
    }
    
    /**
     * Clean up all UI widgets and event subscriptions
     */
    public destroy(): void {
        // Unsubscribe from all flag events
        for (const unsubscribe of this.eventUnsubscribers) {
            unsubscribe();
        }
        this.eventUnsubscribers = [];

        // Destroy UI widgets
        this.team1FlagIcon.Destroy();
        this.team2FlagIcon.Destroy();
        mod.DeleteUIWidget(this.rootContainer);
    }
}


//==============================================================================================
// FLAG ICON UI CLASS
//==============================================================================================

/**
 * FlagIcon - A custom UI widget that renders a flag icon using containers
 * 
 * Creates a flag icon composed of:
 * - A pole (vertical rectangle at the left)
 * - A flag (rectangle at the top)
 * 
 * Supports two rendering modes:
 * - Filled: Solid color fill (2 containers)
 * - Outline: Border-only rendering (6 containers)
 * 
 * Flag proportions (inspired by classic flag design):
 * - Pole: ~10% width, ~60% height (extends below flag)
 * - Flag: ~90% width, ~60% height (top portion only)
 */

interface FlagIconParams {
    name: string;
    position: mod.Vector;
    size: mod.Vector;           // Total flag size [width, height]
    anchor: mod.UIAnchor;
    parent: mod.UIWidget;
    visible?: boolean;
    fillColor?: mod.Vector;         // Fill color (default: white)
    fillAlpha?: number;             // Fill alpha (default: 1.0)
    outlineColor?: mod.Vector;      // Outline color (default: white)
    outlineAlpha?: number;          // Outline alpha (default: 1.0)
    outlineThickness?: number;      // Outline thickness in pixels (default: 2)
    showFill?: boolean;             // Show filled version (default: true)
    showOutline?: boolean;          // Show outline version (default: false)
    teamId?: mod.Team;
    playerId?: mod.Player;
    bgFill?: mod.UIBgFill;
    flagPoleGap?: number;
}

class FlagIcon {
    private rootContainer: mod.UIWidget;
    private fillContainers: mod.UIWidget[] = [];     // Containers for filled version
    private outlineContainers: mod.UIWidget[] = [];  // Containers for outline version
    
    private readonly params: FlagIconParams;
    isPulsing: boolean;
    
    // Flag proportions
    private readonly POLE_WIDTH_RATIO = 0.1666667;
    private readonly POLE_HEIGHT_RATIO = 1.0;
    private readonly FLAG_WIDTH_RATIO = 0.85;
    private readonly FLAG_HEIGHT_RATIO = 0.55;
    
    constructor(params: FlagIconParams) {
        // Default values
        this.params = params;
        this.params.showFill = params.showFill ?? true;
        this.params.showOutline = params.showOutline ?? false;
        this.params.fillColor = VectorClampToRange(params.fillColor ?? mod.CreateVector(1, 1, 1), 0, 1);
        this.params.fillAlpha = params.fillAlpha ?? 1.0;
        this.params.outlineColor = VectorClampToRange(params.outlineColor ?? mod.CreateVector(1, 1, 1), 0, 1);
        this.params.outlineAlpha = params.outlineAlpha ?? 1.0;
        this.params.flagPoleGap = params.flagPoleGap ?? 2.0;

        // UI states
        this.isPulsing = false;

        // Create root container
        this.rootContainer = this.createRootContainer();
        
        // Create both filled and outline versions (layered)
        // Filled version is created first (rendered behind outline)
        this.createFilledFlag();
        this.createOutlineFlag();
        
        // Set initial visibility
        this.SetFillVisible(this.params.showFill ?? true);
        this.SetOutlineVisible(this.params.showOutline ?? true);
    }
    
    private createRootContainer(): mod.UIWidget {
        const root = modlib.ParseUI({
            type: "Container",
            name: this.params.name,
            position: this.params.position,
            size: this.params.size,
            anchor: this.params.anchor,
            parent: this.params.parent,
            visible: this.params.visible ?? true,
            bgAlpha: 0, // Transparent background
            //bgColor: this.params.fillColor ?? ONE_VEC,
            bgFill: mod.UIBgFill.Blur,
            teamId: this.params.teamId,
            playerId: this.params.playerId
        })!;
        
        return root;
    }
    
    private createFilledFlag(): void {
        const totalWidth = mod.XComponentOf(this.params.size);
        const totalHeight = mod.YComponentOf(this.params.size);
        
        const poleWidth = totalWidth * this.POLE_WIDTH_RATIO;
        const poleHeight = totalHeight * this.POLE_HEIGHT_RATIO;
        const flagWidth = totalWidth * this.FLAG_WIDTH_RATIO;
        const flagHeight = totalHeight * this.FLAG_HEIGHT_RATIO;
        const flagPoleGap = this.params.flagPoleGap ?? 2.0;
        
        const color = this.params.fillColor ?? mod.CreateVector(1, 1, 1);
        const alpha = this.params.fillAlpha ?? 1.0;
        const bgFill = this.params.bgFill ?? mod.UIBgFill.Blur;
        
        // Create pole (bottom-left, extending down from flag)
        const poleX = 0;
        const poleY = 0; //totalHeight - poleHeight;
        
        const pole = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_fill_pole`,
            position: [poleX, poleY],
            size: [poleWidth, poleHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: bgFill,
            padding: 0
        })!;

        const flag = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_fill_flag`,
            position: [poleWidth + flagPoleGap, flagPoleGap],
            size: [flagWidth - flagPoleGap, flagHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: bgFill,
            padding: 0
        })!;
        
        // Store both in fill containers array
        this.fillContainers = [pole, flag];
    }
    
    private createOutlineFlag(): void {
        const totalWidth = mod.XComponentOf(this.params.size);
        const totalHeight = mod.YComponentOf(this.params.size);
        const thickness = this.params.outlineThickness ?? 1;
        
        const poleWidth = totalWidth * this.POLE_WIDTH_RATIO;
        const poleHeight = totalHeight * this.POLE_HEIGHT_RATIO;
        const flagWidth = totalWidth * this.FLAG_WIDTH_RATIO;
        const flagHeight = totalHeight * this.FLAG_HEIGHT_RATIO;
        const flagPoleGap = this.params.flagPoleGap ?? 2.0;

        const color = VectorClampToRange(this.params.outlineColor ?? mod.CreateVector(1, 1, 1), 0, 1);
        const alpha = this.params.outlineAlpha ?? 1.0;

        const flag = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_outline_flag`,
            position: [poleWidth + flagPoleGap, flagPoleGap],
            size: [flagWidth - flagPoleGap, flagHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: mod.UIBgFill.OutlineThin,
            padding: 0,
            thickness: thickness
        })!;

        const pole = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_outline_pole`,
            position: [0, 0],
            size: [poleWidth, poleHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: mod.UIBgFill.OutlineThin,
            padding: 0
        })!;
        
        // Store all outline segments in outline containers array
        this.outlineContainers = [flag, pole];
    }

    IsVisible(): boolean {
        return mod.GetUIWidgetVisible(this.rootContainer);
    }
    
    /**
     * Show or hide the filled version of the flag
     */
    SetFillVisible(visible: boolean): void {
        this.params.showFill = visible;
        this.fillContainers.forEach(container => {
            mod.SetUIWidgetVisible(container, visible);
        });
    }
    
    /**
     * Show or hide the outline version of the flag
     */
    SetOutlineVisible(visible: boolean): void {
        this.params.showOutline = visible;
        this.outlineContainers.forEach(container => {
            mod.SetUIWidgetVisible(container, visible);
        });
    }
    
    /**
     * Check if fill is currently visible
     */
    IsFillVisible(): boolean {
        return this.params.showFill ?? false;
    }
    
    /**
     * Check if outline is currently visible
     */
    IsOutlineVisible(): boolean {
        return this.params.showOutline ?? false;
    }

    async StartThrob(pulseSpeed?: number, minimumAlpha?: number, maximumAlpha?: number): Promise<void> {
        if(this.isPulsing)
            return;

        let minAlpha = minimumAlpha ?? 0;
        let maxAlpha = maximumAlpha ?? 1;
        let speed = pulseSpeed ?? 0.1;

        this.isPulsing = true;
        let blink_on: boolean = false;

        while(this.isPulsing){
            blink_on = !blink_on;
            let alpha = blink_on ? maxAlpha : minAlpha;
            this.SetFillAlpha(alpha);
            if(this.params.showOutline)
                this.SetOutlineAlpha(alpha);
            await mod.Wait(0.5);
        }
    }

    StopThrob(): void {
        this.isPulsing = false;
    }
    
    /**
     * Update the fill color and optionally the alpha
     */
    SetFillColor(color: mod.Vector, alpha?: number): void {
        const newAlpha = alpha ?? this.params.fillAlpha ?? 1.0;
        let clampedColor = VectorClampToRange(color, 0, 1);

        // Update fill containers
        this.fillContainers.forEach(container => {
            mod.SetUIWidgetBgColor(container, clampedColor);
            mod.SetUIWidgetBgAlpha(container, newAlpha);
        });
        
        // Store new values
        this.params.fillColor = clampedColor;
        this.params.fillAlpha = newAlpha;
    }

    SetFillAlpha(alpha: number): void {
        if(AreFloatsEqual(alpha, this.params.fillAlpha ?? 1.0))
            return;
        
        this.params.fillAlpha = alpha;
        
        // Update fill containers
        this.fillContainers.forEach(container => {
            mod.SetUIWidgetBgAlpha(container, alpha);
        });
    }

    
    /**
     * Update the outline color and optionally the alpha
     */
    SetOutlineColor(color: mod.Vector, alpha?: number): void {
        const newAlpha = alpha ?? this.params.outlineAlpha ?? 1.0;
        let clampedColor = VectorClampToRange(color, 0, 1);
        
        // Update outline containers
        this.outlineContainers.forEach(container => {
            mod.SetUIWidgetBgColor(container, clampedColor);
            mod.SetUIWidgetBgAlpha(container, newAlpha);
        });
        
        // Store new values
        this.params.outlineColor = clampedColor;
        this.params.outlineAlpha = newAlpha;
    }

    SetOutlineAlpha(alpha: number): void {
        if(AreFloatsEqual(alpha, this.params.outlineAlpha ?? 1.0))
            return;
        
        this.params.outlineAlpha = alpha;
        
        // Update fill containers
        this.outlineContainers.forEach(container => {
            mod.SetUIWidgetBgAlpha(container, alpha);
        });
    }
    
    /**
     * Update both fill and outline colors
     */
    SetColor(color: mod.Vector, alpha?: number): void {
        this.SetFillColor(color, alpha);
        this.SetOutlineColor(color, alpha);
    }
    
    /**
     * Move the entire flag to a new position
     */
    SetPosition(position: mod.Vector): void {
        mod.SetUIWidgetPosition(this.rootContainer, position);
        this.params.position = position;
    }
    
    /**
     * Change the parent widget
     */
    SetParent(parent: mod.UIWidget): void {
        mod.SetUIWidgetParent(this.rootContainer, parent);
        this.params.parent = parent;
    }
    
    /**
     * Show or hide the flag
     */
    SetVisible(visible: boolean): void {
        mod.SetUIWidgetVisible(this.rootContainer, visible);
    }
    
    /**
     * Clean up all UI widgets
     */
    Destroy(): void {
        // Delete fill containers
        this.fillContainers.forEach(container => {
            mod.DeleteUIWidget(container);
        });
        
        // Delete outline containers
        this.outlineContainers.forEach(container => {
            mod.DeleteUIWidget(container);
        });
        
        // Delete root container
        mod.DeleteUIWidget(this.rootContainer);
        
        this.fillContainers = [];
        this.outlineContainers = [];
    }
    
    /**
     * Get the root container widget
     */
    GetRootWidget(): mod.UIWidget {
        return this.rootContainer;
    }
}


enum TeamOrders {
    OurFlagTaken = 0,
    OurFlagDropped,
    OurFlagReturned,
    OurFlagCaptured,
    EnemyFlagTaken,
    EnemyFlagDropped,
    EnemyFlagReturned,
    EnemyFlagCaptured,
    TeamIdentify
}

class TeamOrdersBar extends TickerWidget {
    team: mod.Team;
    teamId: number;
    lastOrder: TeamOrders;
    private eventUnsubscribers: Array<() => void> = [];

    // Animation state
    private isExpanded: boolean = false;
    private isAnimating: boolean = false;
    private isTextVisible: boolean = false;
    private collapseTimeoutTime: number | null = null;
    private readonly normalHeight: number = 30;
    private readonly minimizedHeight: number = 0;
    private readonly expandDuration: number = 0.4;
    private readonly collapseDuration: number = 0.3;
    private readonly visibleDuration: number = 5.0;
    private currentHeight: number = 4;

    constructor(team:mod.Team, tickerParams: TickerWidgetParams) {
         // Call parent constructor with team-specific colors
        super({
            position: tickerParams.position,
            size: tickerParams.size,
            parent: tickerParams.parent,
            textSize: tickerParams.textSize,
            bracketTopBottomLength: tickerParams.bracketTopBottomLength,
            bracketThickness: tickerParams.bracketThickness,
            bgColor: GetTeamColor(team),
            textColor: 
            VectorClampToRange(
                GetTeamColorLight(team), 
                0, 
                1
            ),
            bgAlpha: 0.75
        });

        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.lastOrder = TeamOrders.TeamIdentify;

        // Set initial text (widget now exists after super() called createWidgets())
        this.updateText(this.TeamOrderToMessage(this.lastOrder, this.team));

        // Initialize in minimized state (after widgets are created)
        this.updateWidgetSizes(this.minimizedHeight);
        const textWidget = (this as any).textWidget as mod.UIWidget;
        if (textWidget) {
            mod.SetUIWidgetVisible(textWidget, false);
            this.isTextVisible = false;
        }

        // Bind to all flag events
        this.bindFlagEvents();
    }

    /**
     * Update widget sizes for animation
     * @param height The new height in pixels
     */
    private updateWidgetSizes(height: number): void {
        this.currentHeight = height;
        const newSize = mod.CreateVector(this.size[0], height, 0);
        const columnWidget = (this as any).columnWidget as mod.UIWidget;
        const columnWidgetOutline = (this as any).columnWidgetOutline as mod.UIWidget;
        mod.SetUIWidgetSize(columnWidget, newSize);
        mod.SetUIWidgetSize(columnWidgetOutline, newSize);
    }

    /**
     * Expand bar animation from minimized to normal state
     */
    private async expandBar(): Promise<void> {
        if (this.isAnimating) return;

        // Cancel any pending collapse
        this.collapseTimeoutTime = null;

        this.isAnimating = true;
        const startHeight = this.currentHeight;

        let startColorVec = mod.GetUIWidgetBgColor(this.columnWidget);
        let startColor:number[] = [mod.XComponentOf(startColorVec), mod.YComponentOf(startColorVec), mod.ZComponentOf(startColorVec)];
        let endColorVec = VectorClampToRange(mod.Add(startColorVec, mod.CreateVector(0.75, 0.75, 0.75)), 0, 1);
        let endColor:number[] = [mod.XComponentOf(endColorVec), mod.YComponentOf(endColorVec), mod.ZComponentOf(endColorVec)];

        await animationManager.AnimateValue(startHeight, this.normalHeight, {
            duration: this.expandDuration,
            easingFunction: Easing.EaseOutCubic,
            onProgress: (height, normalizedTime) => {
                this.updateWidgetSizes(height);

                // Show text at 50% progress
                if (normalizedTime >= 0.5 && !this.isTextVisible) {
                    const textWidget = (this as any).textWidget as mod.UIWidget;
                    mod.SetUIWidgetVisible(textWidget, true);
                    this.isTextVisible = true;
                }
            }
        }).then(async () => {
            this.isExpanded = true;
            this.isAnimating = false;
            this.startCollapseTimer();
        });
    }

    /**
     * Collapse bar animation from normal to minimized state
     */
    private async collapseBar(): Promise<void> {
        if (this.isAnimating || !this.isExpanded) return;

        // Cancel any pending collapse
        this.collapseTimeoutTime = null;

        this.isAnimating = true;
        const startHeight = this.currentHeight;

        await animationManager.AnimateValue(startHeight, this.minimizedHeight, {
            duration: this.collapseDuration,
            easingFunction: Easing.EaseInCubic,
            onProgress: (height, normalizedTime) => {
                this.updateWidgetSizes(height);

                // Hide text at 50% progress
                if (normalizedTime >= 0.5 && this.isTextVisible) {
                    const textWidget = (this as any).textWidget as mod.UIWidget;
                    mod.SetUIWidgetVisible(textWidget, false);
                    this.isTextVisible = false;
                }
            },
            onComplete: () => {
                this.isExpanded = false;
                this.isAnimating = false;
            }
        });
    }

    /**
     * Start the timer for auto-collapse
     */
    private startCollapseTimer(): void {
        // Set timeout time
        this.collapseTimeoutTime = GetCurrentTime() + this.visibleDuration;

        // Start async countdown
        this.checkCollapseTimeout();
    }

    /**
     * Check if collapse timeout has elapsed
     */
    private async checkCollapseTimeout(): Promise<void> {
        if (this.collapseTimeoutTime === null) return;

        const timeoutTime = this.collapseTimeoutTime;

        // Wait for the duration
        await mod.Wait(this.visibleDuration);

        // Check if timeout wasn't cancelled or reset
        if (this.collapseTimeoutTime === timeoutTime && this.isExpanded && !this.isAnimating) {
            this.collapseBar();
        }
    }

    private bindFlagEvents(): void {
        // Bind to each flag's events
        for (let [flagId, flag] of flags) {
            // Flag taken event
            const unsubTaken = flag.events.on('flagTaken', (data) => {
                this.handleFlagTaken(data.flag, data.player, data.isAtHome);
            });
            this.eventUnsubscribers.push(unsubTaken);
            
            // Flag dropped event
            const unsubDropped = flag.events.on('flagDropped', (data) => {
                this.handleFlagDropped(data.flag, data.position, data.previousCarrier);
            });
            this.eventUnsubscribers.push(unsubDropped);
            
            // Flag returned event
            const unsubReturned = flag.events.on('flagReturned', (data) => {
                this.handleFlagReturned(data.flag, data.player);
            });
            this.eventUnsubscribers.push(unsubReturned);

            const unsubCaptured = flag.events.on("flagCaptured", (data) => {
                this.handleFlagCaptured(data.flag, data.player);
            });
            this.eventUnsubscribers.push(unsubCaptured);
        }
    }
    
    private handleFlagTaken(flag: Flag, player: mod.Player, wasAtHome: boolean): void {
        const playerTeamId = mod.GetObjId(mod.GetTeam(player));
        
        // Check if this is our team's flag
        if (flag.teamId === this.teamId) {
            // Our flag was taken
            this.SetTeamOrder(TeamOrders.OurFlagTaken, this.team, player);
        } else if (playerTeamId === this.teamId) {
            // We took the enemy flag
            this.SetTeamOrder(TeamOrders.EnemyFlagTaken, mod.GetTeam(player), player);
        }
    }
    
    private handleFlagDropped(flag: Flag, position: mod.Vector, previousCarrier: mod.Player | null): void {
        if(!previousCarrier)
            return;
        
        // Check if this is our team's flag
        if (flag.teamId === this.teamId) {
            // Our flag was dropped
            this.SetTeamOrder(TeamOrders.OurFlagDropped, this.team, previousCarrier);
        } else {
            // Enemy flag was dropped (check if we were carrying it)
            if (previousCarrier) {
                let otherTeam = mod.GetTeam(previousCarrier);
                const carrierTeamId = mod.GetObjId(otherTeam);
                if (carrierTeamId === this.teamId) {
                    this.SetTeamOrder(TeamOrders.EnemyFlagDropped, otherTeam, previousCarrier);
                }
            }
        }
    }
    
    private handleFlagReturned(flag: Flag, player: mod.Player | undefined): void {
        if(player){
            // Check if this is our team's flag
            if (flag.teamId === this.teamId) {
                // Our flag was returned
                this.SetTeamOrder(TeamOrders.OurFlagReturned, this.team, player);
            } else {
                // Enemy flag was returned
                this.SetTeamOrder(TeamOrders.EnemyFlagReturned, mod.GetTeam(player), player);
            }
        } else {
            // Flag was auto returned
            if (flag.teamId === this.teamId) {
                // Our flag was returned
                this.SetTeamOrder(TeamOrders.OurFlagReturned, this.team, player);
            } else {
                // Enemy flag was returned
                this.SetTeamOrder(TeamOrders.EnemyFlagReturned, flag.team, player);
            }
        }
    }

     private handleFlagCaptured(flag: Flag, player: mod.Player): void {
        // Check if this is our team's flag
        if (flag.teamId === this.teamId) {
            // Our flag was captured
            this.SetTeamOrder(TeamOrders.OurFlagCaptured, this.team, player);
        } else {
            // Enemy flag was returned
            this.SetTeamOrder(TeamOrders.EnemyFlagCaptured, mod.GetTeam(player), player);
        }
    }
    
    refresh(): void {
        // Update display based on current flag states
        // This is called periodically to ensure UI is in sync
    }
    
    destroy(): void {
        // Cancel any pending collapse animation
        this.collapseTimeoutTime = null;

        // Clean up event listeners
        for (const unsubscribe of this.eventUnsubscribers) {
            unsubscribe();
        }
        this.eventUnsubscribers = [];

        // Call parent destroy to clean up UI widgets
        super.destroy();
    }

    SetTeamOrder(teamOrder: TeamOrders, team:mod.Team, player?:mod.Player): void {
        this.lastOrder = teamOrder;
        this.updateText(this.TeamOrderToMessage(teamOrder, team, player));

        // Trigger expand animation if not already expanded
        if (!this.isExpanded && !this.isAnimating) {
            this.expandBar(); // Fire and forget (non-blocking)
        } else if (this.isExpanded) {
            // Already expanded, just reset the collapse timer
            this.startCollapseTimer();
        }
    }

    TeamOrderToMessage(order:TeamOrders, team: mod.Team, player?:mod.Player): mod.Message {
        // Messages relating to a specific player
        if(player){
            switch(order){
                case TeamOrders.OurFlagTaken:
                    return mod.Message(mod.stringkeys.order_flag_taken_friendly, player);
                case TeamOrders.OurFlagDropped:
                    return mod.Message(mod.stringkeys.order_flag_dropped_friendly, player);
                case TeamOrders.OurFlagReturned:
                    return mod.Message(mod.stringkeys.order_flag_returned_friendly, player);
                case TeamOrders.OurFlagCaptured:
                    return mod.Message(mod.stringkeys.order_flag_captured_friendly, player);
                case TeamOrders.EnemyFlagTaken:
                    return mod.Message(mod.stringkeys.order_flag_taken_enemy, player, GetTeamName(team));
                case TeamOrders.EnemyFlagDropped:
                    return mod.Message(mod.stringkeys.order_flag_dropped_enemy, player, GetTeamName(team));
                case TeamOrders.EnemyFlagReturned:
                    return mod.Message(mod.stringkeys.order_flag_returned_enemy, player, GetTeamName(team));
                case TeamOrders.EnemyFlagCaptured:
                    return mod.Message(mod.stringkeys.order_flag_captured_enemy, player, GetTeamName(team));
            }
        } else {
            // General team messages
            switch(order){
                case TeamOrders.OurFlagReturned:
                    return mod.Message(mod.stringkeys.order_flag_returned_timeout_friendly);
                case TeamOrders.EnemyFlagReturned:
                    return mod.Message(mod.stringkeys.order_flag_returned_timeout_enemy, GetTeamName(team));
            }
           
        }
        
        return mod.Message(mod.stringkeys.order_team_identifier, GetTeamName(this.team));
    }
}


//==============================================================================================
// MULTI 2+ TEAM CTF HUD
//==============================================================================================

/**
 * Get the text representation of a flag's current status
 * @param flag The flag to get status for
 * @returns Status message: "(  )" for home, "<  >" for carried, "[  ]" for dropped
 */
function BuildFlagStatus(flag: Flag): mod.Message {
    if (flag.isAtHome) return mod.Message(mod.stringkeys.scoreUI_flag_status_home);
    if (flag.isBeingCarried) return mod.Message(mod.stringkeys.scoreUI_flag_status_carried);
    if (flag.isDropped) return mod.Message(mod.stringkeys.scoreUI_flag_status_dropped);
    return mod.Message(mod.stringkeys.scoreUI_flag_status_home); // Default to home
}

/**
 * TeamColumnWidget - Displays a single team's score and flag status
 * Encapsulates the score ticker and flag icon
 */
class TeamColumnWidget {
    readonly teamId: number;
    readonly team: mod.Team;
    readonly isPlayerTeam: boolean;
    readonly scoreTicker: ScoreTicker;
    readonly flagIcon: FlagIcon;
    readonly verticalPadding:number = 8;
    private eventUnsubscribers: (() => void)[] = [];

    constructor(team: mod.Team, position: number[], size: number[], parent: mod.UIWidget, isPlayerTeam:boolean) {
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.isPlayerTeam = isPlayerTeam;

        // Create score ticker with bracket indicators
        this.scoreTicker = new ScoreTicker({
            team: team,
            position: position,
            size: size,
            parent: parent,
            textSize: 28,
            bracketTopBottomLength: 10,
            bracketThickness: 3
        });

        // Create flag icon below the score ticker
        let flagIconConfig: FlagIconParams = {
            name: `FlagHomeIcon_Team${this.teamId}`,
            parent: parent,
            position: mod.CreateVector(position[0], position[1] + size[1] + this.verticalPadding, 0),
            size: mod.CreateVector(30, 30, 0),
            anchor: mod.UIAnchor.TopCenter,
            fillColor:  GetTeamColorById(this.teamId),
            fillAlpha: 1,
            outlineColor: GetTeamColorById(this.teamId),
            outlineAlpha: 1,
            showFill: true,
            showOutline: true,
            bgFill: mod.UIBgFill.Solid,
            outlineThickness: 1
        };
        this.flagIcon = new FlagIcon(flagIconConfig);

        // Subscribe to flag events
        this.bindFlagEvents();
    }

    /**
     * Subscribe to flag events for visual feedback
     */
    private bindFlagEvents(): void {
        const flag = flags.get(this.teamId);
        if (!flag) return;

        // Flag picked up - throb icon
        const unsubTaken = flag.events.on('flagTaken', (data) => {
            this.flagIcon.SetVisible(true);
            this.flagIcon.SetFillVisible(true);
            this.flagIcon.SetOutlineVisible(false);
            if (!this.flagIcon.isPulsing) {
                this.flagIcon.StartThrob(1, 0.15, 1);
            }
        });
        this.eventUnsubscribers.push(unsubTaken);

        // Flag dropped - show outline
        const unsubDropped = flag.events.on('flagDropped', (data) => {
            if (this.flagIcon.isPulsing) {
                this.flagIcon.StopThrob();
            }
            this.flagIcon.SetFillVisible(false);
            this.flagIcon.SetOutlineVisible(true);
            this.flagIcon.SetOutlineAlpha(1);
        });
        this.eventUnsubscribers.push(unsubDropped);

        // Flag returned - normal fill
        const unsubReturned = flag.events.on('flagReturned', (data) => {
            this.flagIcon.SetVisible(true);
            if (this.flagIcon.isPulsing) {
                this.flagIcon.StopThrob();
            }
            this.flagIcon.SetOutlineVisible(true);
            this.flagIcon.SetFillVisible(true);
            this.flagIcon.SetFillAlpha(1);
            this.flagIcon.SetOutlineAlpha(1);
        });
        this.eventUnsubscribers.push(unsubReturned);
    }
    
    /**
     * Update the team's score display
     */
    update(): void {
        // Update score ticker
        this.scoreTicker.updateScore();
        // Flag visual updates are now handled by event subscriptions
    }

    /**
     * Clean up event subscriptions
     */
    destroy(): void {
        // Unsubscribe from all flag events
        for (const unsubscribe of this.eventUnsubscribers) {
            unsubscribe();
        }
        this.eventUnsubscribers = [];
    }
    
    /**
     * Set whether this team is currently in the lead
     */
    setLeading(isLeading: boolean): void {
        this.scoreTicker.setLeading(isLeading);
    }
}

/**
 * ScoreboardUI - Main scoring interface for CTF
 * Shows all team scores with flag statuses
 *
 * GLOBAL SCOPE: Created once per game, visible to all players
 */
class MultiTeamScoreHUD implements BaseScoreboardHUD {
    readonly player: mod.Player;
    readonly playerId: number;

    rootWidget: mod.UIWidget | undefined;
    private teamRow: mod.UIWidget | undefined;
    private teamColumns: Map<number, TeamColumnWidget> = new Map();

    private readonly ROOT_WIDTH = 700;
    private readonly ROOT_HEIGHT = 110;
    private readonly TOP_PADDING = 47;
    private readonly COLUMN_SPACING = 40;

    constructor(player?: mod.Player) {
        // Player is optional - only used to satisfy BaseScoreboardHUD interface
        // This HUD is actually globally scoped
        this.player = (null as any);
        this.playerId = -1;
        this.create();
    }

    create(): void {
        if (this.rootWidget) return;

        // Calculate total width needed based on team count
        const teamCount = teams.size;
        const columnWidth = 60;
        const totalColumnsWidth = (teamCount * columnWidth) + ((teamCount - 1) * this.COLUMN_SPACING);

        // Create GLOBAL root container (NO playerId, NO teamId)
        this.rootWidget = modlib.ParseUI({
            type: "Container",
            size: [totalColumnsWidth, this.ROOT_HEIGHT],
            position: [0, 0],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0
            // NO playerId or teamId = GLOBAL SCOPE
        })!;

        // Create team row container
        this.teamRow = modlib.ParseUI({
            type: "Container",
            parent: this.rootWidget,
            size: [totalColumnsWidth, 50],
            position: [0, this.TOP_PADDING],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.None,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0
        })!;

        // Create team columns
        let currentX = -(totalColumnsWidth / 2) + (columnWidth / 2);

        for (const [teamId, team] of teams.entries()) {
            const columnPos = [currentX, 0];
            const column = new TeamColumnWidget(team, columnPos, [50, 30], this.teamRow, false);
            this.teamColumns.set(teamId, column);
            currentX += columnWidth + this.COLUMN_SPACING;
        }

        // Initial refresh
        this.refresh();
    }
    
    /**
     * Update all UI elements with current game state
     */
    refresh(): void {
        if (!this.rootWidget) return;

        // Determine which team is leading (if any)
        let maxScore = -1;
        let leadingTeams: number[] = [];

        for (const [teamId, score] of teamScores.entries()) {
            if (score > maxScore) {
                maxScore = score;
                leadingTeams = [teamId];
            } else if (score === maxScore && score > 0) {
                leadingTeams.push(teamId);
            }
        }

        // Update each team column
        for (const [teamId, column] of this.teamColumns.entries()) {
            column.update();

            // Show brackets only if this team is the sole leader (no ties)
            const isLeading = leadingTeams.length === 1 && leadingTeams[0] === teamId;
            column.setLeading(isLeading);
        }
    }
    
    /**
     * Close and cleanup the scoreboard UI
     */
    close(): void {
        // Destroy all child widgets first (bottom-up)

        // 1. Destroy all team column widgets
        for (const [teamId, column] of this.teamColumns.entries()) {
            column.destroy();  // Clean up event subscriptions
            column.scoreTicker.destroy();
            column.flagIcon.Destroy();
        }
        this.teamColumns.clear();

        // 2. Delete team row container
        if (this.teamRow) {
            mod.DeleteUIWidget(this.teamRow);
            this.teamRow = undefined;
        }

        // 3. Finally, hide and delete the root widget
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, false);
            mod.DeleteUIWidget(this.rootWidget);
            this.rootWidget = undefined;
        }
    }
    
    /**
     * Check if the scoreboard is currently visible
     */
    isOpen(): boolean {
        return this.rootWidget !== undefined;
    }
}


//==============================================================================================
// CLASSIC 2-TEAM CTF HUD
//==============================================================================================

/**
 * ScoreboardUI - Main scoring interface for CTF
 * Shows all team scores with flag statuses
 *
 * GLOBAL SCOPE: Created once per game, visible to all players
 */
class ClassicCTFScoreHUD implements BaseScoreboardHUD{
    readonly player: mod.Player;
    readonly playerId: number;

    rootWidget: mod.UIWidget | undefined;
    
    // Root padding
    paddingTop: number = 48;

    // Team scores
    teamScoreTickers: Map<number, ScoreTicker> = new Map<number, ScoreTicker>();
    teamScoreSpacing: number = 490;
    teamScorePaddingTop: number = 28;
    teamWidgetSize: number[] = [76, 30];

    // Round timer
    timerTicker: RoundTimer | undefined;
    timerWidgetSize: number[] = [74, 22];

    // Flag bar
    flagBar: FlagBar | undefined;
    flagBarWidthPadding = 20;
    flagBarHeight = 12;

    constructor(player?: mod.Player) {
        // Player is optional - only used to satisfy BaseScoreboardHUD interface
        // This HUD is actually globally scoped
        this.player = (null as any);
        this.playerId = -1;
        this.create();
    }
    
    create(): void {
        if (this.rootWidget) return;

        // Create GLOBAL root container (NO playerId, NO teamId)
        this.rootWidget = modlib.ParseUI({
            type: "Container",
            size: [700, 50],
            position: [0, this.paddingTop],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0
            // NO playerId or teamId = GLOBAL SCOPE
        })!;

        // Create team score tickers
        for (const [teamId, team] of teams.entries()) {
            if (teamId === 0) continue; // Skip neutral team

            let tickerParams: ScoreTickerParams = {
                parent: this.rootWidget,
                position: [((teamId - 1) * this.teamScoreSpacing) - this.teamScoreSpacing * 0.5, this.teamScorePaddingTop],
                size: this.teamWidgetSize,
                team: team,
                reversePulse: (teamId - 1) % 2 == 0
            };
            this.teamScoreTickers.set(teamId, new ScoreTicker(tickerParams));
            this.teamScoreTickers.get(teamId)?.pulse();
        }

        // Center flag bar positions
        const barWidth = this.teamScoreSpacing - this.teamWidgetSize[0] - this.flagBarWidthPadding;
        const barPosX = 0;  // Center horizontally
        const barPosY = this.teamScorePaddingTop + (this.teamWidgetSize[1] / 2) - (this.flagBarHeight * 0.5);

        // Create flag bar (positioned between the two score tickers)
        const team1 = teams.get(1);
        const team2 = teams.get(2);

        if (team1 && team2) {
            // Get capture zone positions
            const team1CaptureZone = captureZones.get(1);
            const team2CaptureZone = captureZones.get(2);

            if (team1CaptureZone && team2CaptureZone) {
                this.flagBar = new FlagBar({
                    position: [barPosX, barPosY],
                    size: [barWidth, 16],
                    parent: this.rootWidget,
                    team1: team1,
                    team2: team2,
                    team1CaptureZonePosition: team1CaptureZone.position,
                    team2CaptureZonePosition: team2CaptureZone.position,
                    barHeight: this.flagBarHeight,
                    barSeperatorPadding: 4,
                    flagIconSize: [24, 24]
                });
            }
        }

        // Create round timer
        this.timerTicker = new RoundTimer({
            position: [0, 0],
            parent: this.rootWidget,
            textSize: 26,
            size: this.timerWidgetSize,
            bgAlpha: 0.5,
            textColor: mod.CreateVector(0.9, 0.9, 0.9)
        });

        // Initial refresh
        this.refresh();
    }
    
    /**
     * Update all UI elements with current game state
     */
    refresh(): void {
        if (!this.rootWidget) return;
        
        for(let [teamId, widget] of this.teamScoreTickers.entries()){
            widget.refresh();
        }

        this.timerTicker?.refresh();
        
        // Update flag bar (deltaTime = 1.0 since refresh is called at 1Hz)
        this.flagBar?.update(flags, 1.0);
    }
    
    /**
     * Close and cleanup the scoreboard UI
     */
    close(): void {
        // Destroy all child widgets first (bottom-up)

        // 1. Destroy team score tickers
        for (const [teamId, ticker] of this.teamScoreTickers.entries()) {
            ticker.destroy();
        }
        this.teamScoreTickers.clear();

        // 2. Destroy flag bar (which also destroys its children)
        if (this.flagBar) {
            this.flagBar.destroy();
            this.flagBar = undefined;
        }

        // 3. Destroy timer ticker
        if (this.timerTicker) {
            this.timerTicker.destroy();
            this.timerTicker = undefined;
        }

        // 4. Finally, hide and delete the root widget
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, false);
            mod.DeleteUIWidget(this.rootWidget);
            this.rootWidget = undefined;
        }
    }
    
    /**
     * Check if the scoreboard is currently visible
     */
    isOpen(): boolean {
        return this.rootWidget !== undefined;
    }
}


//==============================================================================================
// GLOBAL SCOREBOARD HUD - Manager for globally-scoped HUD instances
//==============================================================================================

/**
 * GlobalScoreboardHUD - Singleton manager that creates and manages global HUD instances
 *
 * This manager creates ONE instance of the appropriate HUD class (MultiTeamScoreHUD or ClassicCTFScoreHUD)
 * that is visible to ALL players (global scope).
 */
class GlobalScoreboardHUD {
    private static instance: GlobalScoreboardHUD | null = null;
    private globalHUD: BaseScoreboardHUD | null = null;

    private constructor() {
        // Private constructor for singleton
    }

    /**
     * Get or create the singleton instance
     */
    static getInstance(): GlobalScoreboardHUD {
        if (!GlobalScoreboardHUD.instance) {
            GlobalScoreboardHUD.instance = new GlobalScoreboardHUD();
        }
        return GlobalScoreboardHUD.instance;
    }

    /**
     * Initialize the global HUD based on the current game mode configuration
     * @param hudClass The HUD class to instantiate (must implement BaseScoreboardHUD)
     */
    createGlobalHUD(hudClass: new (player?: mod.Player) => BaseScoreboardHUD): void {
        if (this.globalHUD) {
            console.log("GlobalScoreboardHUD: Global HUD already exists, skipping creation");
            return;
        }

        // Create single global instance (no player parameter)
        this.globalHUD = new hudClass();

        if (DEBUG_MODE) {
            console.log(`GlobalScoreboardHUD: Created global ${hudClass.name} instance`);
        }
    }

    /**
     * Refresh the global HUD
     */
    refresh(): void {
        if (this.globalHUD) {
            this.globalHUD.refresh();
        }
    }

    /**
     * Close the global HUD
     */
    close(): void {
        if (this.globalHUD) {
            this.globalHUD.close();
            this.globalHUD = null;
        }
    }

    /**
     * Reset singleton instance (for game restart)
     */
    static reset(): void {
        if (GlobalScoreboardHUD.instance) {
            GlobalScoreboardHUD.instance.close();
            GlobalScoreboardHUD.instance = null;
        }
    }

    /**
     * Get the current global HUD instance
     */
    getHUD(): BaseScoreboardHUD | null {
        return this.globalHUD;
    }
}


//==============================================================================================
// TEAM SCOREBOARD HUD - Team-scoped widgets visible to all players on a team
//==============================================================================================

/**
 * TeamScoreboardHUD - Manages UI widgets that display team-specific information
 * Created once per team, visible to all players on that team.
 *
 * Contains:
 * - TeamOrdersBar (shows team-specific orders and flag events)
 */
class TeamScoreboardHUD {
    private static instances: Map<number, TeamScoreboardHUD> = new Map();

    readonly team: mod.Team;
    readonly teamId: number;
    readonly rootWidget: mod.UIWidget | undefined;
    private teamOrdersBar!: TeamOrdersBar;
    position: number[] = [0, 100];

    private constructor(team: mod.Team, position?: number[]) {
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.position = position ?? this.position;
        
        console.log(`Creating TeamScoreboardHUD for team ${this.teamId}`);

        // Create TEAM-SCOPED root container
        this.rootWidget = modlib.ParseUI({
            type: "Container",
            size: [400, 30],
            position:  this.position,
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0,
            teamId: team  // TEAM-SCOPED: visible to all players on this team
        })!;

        // Create TeamOrdersBar
        this.teamOrdersBar = new TeamOrdersBar(team, {
            position: [0, 0],
            size: [400, 30],
            parent: this.rootWidget,
            textSize: 22,
            bgAlpha: 0.5
        });

        if (DEBUG_MODE) {
            console.log(`TeamScoreboardHUD: Created team-scoped HUD for team ${this.teamId}`);
        }
    }

    /**
     * Create or get team HUD instance for a specific team
     */
    static create(team: mod.Team): TeamScoreboardHUD {
        const teamId = mod.GetObjId(team);

        let instance = TeamScoreboardHUD.instances.get(teamId);
        if (!instance) {
            instance = new TeamScoreboardHUD(team);
            TeamScoreboardHUD.instances.set(teamId, instance);
        }

        return instance;
    }

    /**
     * Get existing team HUD instance
     */
    static getInstance(teamId: number): TeamScoreboardHUD | undefined {
        return TeamScoreboardHUD.instances.get(teamId);
    }

    /**
     * Get all team HUD instances
     */
    static getAllInstances(): TeamScoreboardHUD[] {
        return Array.from(TeamScoreboardHUD.instances.values());
    }

    /**
     * Refresh the team-specific widgets
     */
    refresh(): void {
        this.teamOrdersBar.refresh();
    }

    /**
     * Close and cleanup team widgets
     */
    close(): void {
        // Destroy child widgets first
        if (this.teamOrdersBar) {
            this.teamOrdersBar.destroy();
        }

        // Delete root widget
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, false);
            mod.DeleteUIWidget(this.rootWidget);
        }

        // Remove this instance from the registry
        TeamScoreboardHUD.instances.delete(this.teamId);
    }

    /**
     * Check if this team HUD is open
     */
    isOpen(): boolean {
        return this.rootWidget !== undefined && mod.GetUIWidgetVisible(this.rootWidget);
    }

    /**
     * Destroy all team HUD instances and clear the registry
     */
    static destroyAll(): void {
        for (const [teamId, instance] of TeamScoreboardHUD.instances.entries()) {
            instance.close();
        }
        TeamScoreboardHUD.instances.clear();

        if (DEBUG_MODE) {
            console.log('All team scoreboards destroyed');
        }
    }

    /**
     * Reset all team HUD instances (for game restart)
     */
    static reset(): void {
        TeamScoreboardHUD.destroyAll();
    }
}


//==============================================================================================
// PLAYER SCOREBOARD HUD - Player-scoped widgets visible only to specific player
//==============================================================================================

/**
 * PlayerScoreboardHUD - Manages UI widgets that display player-specific information
 * Created once per player, visible only to that player.
 *
 * Currently empty - reserved for future player-specific widgets.
 * TeamOrdersBar is in TeamScoreboardHUD (team-scoped) to avoid duplication.
 */
class PlayerScoreboardHUD implements BaseScoreboardHUD {
    readonly player: mod.Player;
    readonly playerId: number;
    rootWidget: mod.UIWidget | undefined;

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        this.create();
    }

    create(): void {
        if (this.rootWidget) return;

        // Create PLAYER-SCOPED root container (empty for now, ready for future widgets)
        const root = modlib.ParseUI({
            type: "Container",
            size: [400, 30],
            position: [0, 150],  // Position below team-scoped widgets
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.None,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0,
            playerId: this.player  // PLAYER-SCOPED: visible only to this player
        })!;

        this.rootWidget = root;

        if (DEBUG_MODE) {
            console.log(`PlayerScoreboardHUD: Created player-scoped HUD container for player ${this.playerId}`);
        }

        // Initial refresh
        this.refresh();
    }

    /**
     * Refresh the player-specific widgets
     */
    refresh(): void {
        if (!this.rootWidget) return;
        // No widgets to refresh yet
    }

    /**
     * Close and cleanup player widgets
     */
    close(): void {
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, false);
        }
        // No widgets to destroy yet
    }

    /**
     * Check if this player HUD is open
     */
    isOpen(): boolean {
        return this.rootWidget !== undefined && mod.GetUIWidgetVisible(this.rootWidget);
    }
}


//==============================================================================================
// GAMEMODE CONFIGURATION AND LOADING 
//==============================================================================================

interface TeamConfig {
    teamId: number;
    name?: string;
    color?: mod.Vector;
    captureZones?: CaptureZoneConfig[] // Array of capture points for this team
}

interface FlagConfig {
    flagId: number;
    owningTeamId: TeamID;
    allowedCapturingTeams?: number[];  // Empty = any opposing team can capture
    customColor?: mod.Vector;  // Optional color override
    spawnObjectId?: number;
}

class CaptureZoneConfig {
    team: mod.Team;
    captureZoneID?: number;
    captureZoneSpatialObjId?: number;

    constructor(team: mod.Team, captureZoneID?: number, captureZoneSpatialObjId?:number){
        this.team = team;
        this.captureZoneID = captureZoneID;
        this.captureZoneSpatialObjId;
    }
}

interface GameModeConfig {
    teams: TeamConfig[];
    flags: FlagConfig[];
    HUDClass?: new (player?: mod.Player) => BaseScoreboardHUD;
}

// Store the HUD class to use for global HUD (player parameter is optional)
let currentHUDClass: (new (player?: mod.Player) => BaseScoreboardHUD) | undefined;

function LoadGameModeConfig(config: GameModeConfig): void {
    // Store HUD class for use in JSPlayer constructor
    currentHUDClass = config.HUDClass;
    
    // Clear existing data
    teams.clear();
    teamConfigs.clear();
    teamScores.clear();
    flags.clear();
    
    // Load team configurations
    for (const teamConfig of config.teams) {
        const team = mod.GetTeam(teamConfig.teamId);
        teams.set(teamConfig.teamId, team);
        console.log(`Loading team config for ${teamConfig.teamId}. Colour is ${teamConfig.name}`);
        teamConfigs.set(teamConfig.teamId, teamConfig);
        teamScores.set(teamConfig.teamId, 0);

        // Store capture zones
        if(teamConfig.captureZones){
            for(const captureZoneConfig of teamConfig.captureZones){
                let captureZone = new CaptureZone(
                    captureZoneConfig.team, 
                    captureZoneConfig.captureZoneID, 
                    captureZoneConfig.captureZoneSpatialObjId
                );
                captureZones.set(teamConfig.teamId, captureZone);
            }
        }
        
        if (DEBUG_MODE) {
            console.log(`Loaded team config: ID=${teamConfig.teamId}, Name=${teamConfig.name}`);
        }
    }
    
    // Initialize scoreboard based on team count
    if (config.teams.length === 2) {
        console.log(`Using CustomTwoTeams scoreboard`);
        mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams);
        const team1Config = teamConfigs.get(1);
        const team2Config = teamConfigs.get(2);
        if (team1Config && team2Config) {
            mod.SetScoreboardHeader(
                mod.Message(GetTeamName(team1)), 
                mod.Message(GetTeamName(team2))
            );
            mod.SetScoreboardColumnNames(
                mod.Message(mod.stringkeys.scoreboard_captures_label), 
                mod.Message(mod.stringkeys.scoreboard_capture_assists_label),
                mod.Message(mod.stringkeys.scoreboard_carrier_kills_label)
            );

            // Sort by flag captures
            //mod.SetScoreboardSorting(1);
        }
    } else {
        console.log(`Using CustomFFA scoreboard`);
        // 3+ teams: Use FFA scoreboard with Team ID as first column
        mod.SetScoreboardType(mod.ScoreboardType.CustomFFA);
        mod.SetScoreboardColumnNames(
            mod.Message(mod.stringkeys.scoreboard_team_label),
            mod.Message(mod.stringkeys.scoreboard_captures_label), 
            mod.Message(mod.stringkeys.scoreboard_capture_assists_label),
            mod.Message(mod.stringkeys.scoreboard_carrier_kills_label)
        );
        mod.SetScoreboardColumnWidths(0.2, 0.2, 0.2, 0.4);

        // Sort by teamID to group players - this overload is zero indexed so the first available column is used
        mod.SetScoreboardSorting(0, false);
    }

    // Initialize flags from config
    for (const flagConfig of config.flags) {
        const team = teams.get(flagConfig.owningTeamId);
        if (!team) {
            console.error(`Team ${flagConfig.owningTeamId} not found for flag ${flagConfig.flagId}`);
            continue;
        }
        
        // Get flag spawn position
        const flagSpawn = mod.GetSpatialObject(flagConfig.spawnObjectId ?? GetDefaultFlagSpawnIdForTeam(mod.GetTeam(flagConfig.owningTeamId)));
        const flagPosition = mod.GetObjectPosition(flagSpawn);
        
        // Create flag instance
        const flag = new Flag(
            team,
            flagPosition,
            flagConfig.flagId,
            flagConfig.allowedCapturingTeams,
            flagConfig.customColor
        );
        
        // Store in flags Map
        flags.set(flagConfig.flagId, flag);
        
        if (DEBUG_MODE) {
            console.log(`Initialized flag ${flagConfig.flagId} for team ${flagConfig.owningTeamId} at ${VectorToString(flagPosition)}`);
        }
    }
    
    if (DEBUG_MODE) {
        console.log(`Loaded ${config.teams.length} teams and ${config.flags.length} flags`);
    }
}


//==============================================================================================
// CLASSIC 2-TEAM CTF CONFIG
//==============================================================================================

const ClassicCTFConfig: GameModeConfig = {
    HUDClass: ClassicCTFScoreHUD,
    teams: [
        { 
            teamId: TeamID.TEAM_1, 
            name: mod.stringkeys.purple_team_name, 
            color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_1), 
            captureZones: [
                {
                    team: mod.GetTeam(TeamID.TEAM_1)  // Get team directly instead of using uninitialized variable
                }
            ]
        },
        { 
            teamId: TeamID.TEAM_2, 
            name: mod.stringkeys.orange_team_name, 
            color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_2), 
            captureZones: [
                {
                    team: mod.GetTeam(TeamID.TEAM_2)  // Get team directly instead of using uninitialized variable
                }
            ]
        }
    ],
    flags: [
        {
            flagId: 1,
            owningTeamId: TeamID.TEAM_1,
            //allowedCapturingTeams: [], // Empty = all opposing teams
        },
        {
            flagId: 2,
            owningTeamId: TeamID.TEAM_2,
            //allowedCapturingTeams: [], // Empty = all opposing teams
        }
    ]
}


//==============================================================================================
// MULTI TEAM CTF CONFIG
//==============================================================================================

const FourTeamCTFConfig: GameModeConfig = {
    HUDClass: MultiTeamScoreHUD,
    teams: [
        { 
            teamId: 1, 
            name: mod.stringkeys.purple_team_name, 
            color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_1), 
            captureZones: [
                {
                    team: mod.GetTeam(TeamID.TEAM_1)  // Get team directly
                }
            ]
        },
        { 
            teamId: 2, 
            name: mod.stringkeys.orange_team_name, 
            color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_2), 
            captureZones: [
                {
                    team: mod.GetTeam(TeamID.TEAM_2)  // Get team directly
                }
            ]
        },
        { teamId: 3, 
            name: mod.stringkeys.green_team_name, 
            color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_3), 
            captureZones: [
                {
                    team: mod.GetTeam(TeamID.TEAM_3)  // Get team directly
                }
            ]
        },
        { 
            teamId: 4, 
            name: mod.stringkeys.blue_team_name, 
            color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_4), 
            captureZones: [
                {
                    team: mod.GetTeam(TeamID.TEAM_4)  // Get team directly
                }
            ]
        }
    ],
    flags: [
        {
            flagId: 1,
            owningTeamId: TeamID.TEAM_1,
            //allowedCapturingTeams: [], // Empty = all opposing teams
        },
        {
            flagId: 2,
            owningTeamId: TeamID.TEAM_2,
            //allowedCapturingTeams: [], // Empty = all opposing teams
        },
        {
            flagId: 3,
            owningTeamId: TeamID.TEAM_3,
            //allowedCapturingTeams: [], // Empty = all opposing teams
        },
        {
            flagId: 4,
            owningTeamId: TeamID.TEAM_4,
            //allowedCapturingTeams: [], // Empty = all opposing teams
        }
        // {
        //     flagId: 5,
        //     owningTeamId: TeamID.TEAM_NEUTRAL,
        //     allowedCapturingTeams: [], // Empty = all opposing teams
        //     spawnObjectId: GetDefaultFlagSpawnIdForTeam(teamNeutral)
        // }
    ]
}


const DEFAULT_GAMEMODES = new Map<number, GameModeConfig>([
    [40000, ClassicCTFConfig],
    [40001, FourTeamCTFConfig]
]);


//==============================================================================================
// TEAM BALANCE FUNCTIONS
//==============================================================================================

async function CheckAndBalanceTeams(): Promise<void> {
    if (!TEAM_AUTO_BALANCE || balanceInProgress || !gameStarted) return;
    
    const currentTime = GetCurrentTime();
    if (currentTime - lastBalanceCheckTime < TEAM_BALANCE_CHECK_INTERVAL) return;
    
    lastBalanceCheckTime = currentTime;
    
    // Get player counts for all teams dynamically
    const teamPlayerCounts: { teamId: number, team: mod.Team, players: mod.Player[], count: number }[] = [];
    for (const [teamId, team] of teams.entries()) {
        const players = GetPlayersInTeam(team);
        teamPlayerCounts.push({ teamId, team, players, count: players.length });
    }
    
    // Sort by player count to find largest and smallest teams
    teamPlayerCounts.sort((a, b) => b.count - a.count);
    
    const largestTeam = teamPlayerCounts[0];
    const smallestTeam = teamPlayerCounts[teamPlayerCounts.length - 1];
    
    // Check if teams need balancing (difference > 1)
    if (Math.abs(largestTeam.count - smallestTeam.count) <= 1) return;
    
    balanceInProgress = true;

    // Notify players a balance is about to occur
    mod.DisplayNotificationMessage(
        mod.Message(mod.stringkeys.team_balance_notif)
    );
    
    await mod.Wait(TEAM_BALANCE_DELAY);
    
    // Re-check teams after delay (players might have left)
    const updatedTeamCounts: { teamId: number, team: mod.Team, players: mod.Player[], count: number }[] = [];
    for (const [teamId, team] of teams.entries()) {
        const players = GetPlayersInTeam(team);
        updatedTeamCounts.push({ teamId, team, players, count: players.length });
    }
    
    // Sort again to find current largest and smallest
    updatedTeamCounts.sort((a, b) => b.count - a.count);
    
    const updatedLargest = updatedTeamCounts[0];
    const updatedSmallest = updatedTeamCounts[updatedTeamCounts.length - 1];
    
    // Check if still needs balancing
    if (Math.abs(updatedLargest.count - updatedSmallest.count) <= 1) {
        balanceInProgress = false;
        return;
    }
    
    // Get JSPlayers from largest team, sorted by join order (most recent first)
    const jsPlayers: JSPlayer[] = [];
    for (const player of updatedLargest.players) {
        const jsPlayer = JSPlayer.get(player);
        if (jsPlayer) jsPlayers.push(jsPlayer);
    }
    jsPlayers.sort((a, b) => b.joinOrder - a.joinOrder); // Most recent first
    
    // Move players until balanced
    const playersToMove = Math.floor((updatedLargest.count - updatedSmallest.count) / 2);
    for (let i = 0; i < playersToMove && i < jsPlayers.length; i++) {
        if (jsPlayers[i].player && updatedSmallest.team) {
            try{
                mod.SetTeam(jsPlayers[i].player, updatedSmallest.team);
                // Reset team specific UI elements for this player
                jsPlayers[i].resetUI();

                // Refresh all team-scoped entities that might depend on a player's team
                worldIconManager.refreshAllIcons();
                FixTeamScopedUIVisibility(jsPlayers[i].player);

            } catch(error: unknown){
                console.log(`Could not move player to team`);
            }
            if (DEBUG_MODE) {
                console.log(`Balanced player ${jsPlayers[i].playerId} from team ${updatedLargest.teamId} to team ${updatedSmallest.teamId}`);
            }
        }
    }
    
    balanceInProgress = false;
}

