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
            return new Vec3(mod.XComponentOf(vector), mod.YComponentOf(vector), mod.ZComponentOf(vector));
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
    return Math.sqrt((xLength * xLength) + (yLength * yLength) + (zLength * yLength));
}
