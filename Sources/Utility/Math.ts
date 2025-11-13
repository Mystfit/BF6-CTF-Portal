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
