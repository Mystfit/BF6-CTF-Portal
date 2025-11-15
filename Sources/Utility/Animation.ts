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
