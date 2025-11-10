
const VERSION = [2, 3, 0];
const DEBUG_MODE = false;
const GAMEMODE_TARGET_SCORE = 10;
const FLAG_PICKUP_DELAY = 5;
const FLAG_AUTO_RETURN_TIME = 30;
const CARRIER_FORCED_WEAPON = mod.Gadgets.Melee_Sledgehammer;
const CARRIER_FORCED_WEAPON_SLOT = mod.InventorySlots.MeleeWeapon;
const CARRIER_CAN_HOLD_MULTIPLE_FLAGS = false;
const TEAM_AUTO_BALANCE: boolean = true;
const TEAM_BALANCE_DELAY = 5.0;
const TEAM_BALANCE_CHECK_INTERVAL = 10;
const VEHICLE_BLOCK_CARRIER_DRIVING: boolean = true;
const FLAG_SFX_DURATION = 5.0;
const FLAG_ICON_HEIGHT_OFFSET = 2.5;
const FLAG_INTERACTION_HEIGHT_OFFSET = 1.3;
const FLAG_SPAWN_HEIGHT_OFFSET = 0.5;
const FLAG_COLLISION_RADIUS = 1.5;
const FLAG_COLLISION_RADIUS_OFFSET = 1;
const FLAG_DROP_DISTANCE = 2.5;
const FLAG_DROP_RAYCAST_DISTANCE = 100;
const FLAG_DROP_RING_RADIUS = 2.5;
const FLAG_ENABLE_ARC_THROW = true;
const FLAG_THROW_SPEED = 5;
const FLAG_FOLLOW_DISTANCE = 3;
const FLAG_FOLLOW_POSITION_SMOOTHING = 0.5;
const FLAG_FOLLOW_ROTATION_SMOOTHING = 0.5;
const FLAG_FOLLOW_SAMPLES = 20;
const FLAG_TERRAIN_RAYCAST_SUPPORT = false;
const FLAG_PROP = mod.RuntimeSpawn_Common.MCOM;
const FLAG_FOLLOW_MODE = false;
const FLAG_TERRAIN_FIX_PROTECTION = true;
const SOLDIER_HALF_HEIGHT = 0.75;
const SOLDIER_HEIGHT = 2;
const SPAWN_VALIDATION_DIRECTIONS = 4;
const SPAWN_VALIDATION_MAX_ITERATIONS = 1;
const SPAWN_VALIDATION_HEIGHT_OFFSET = 0.75;
const VEHICLE_DRIVER_SEAT = 0;
const VEHICLE_FIRST_PASSENGER_SEAT = 1;
const TICK_RATE = 0.032;
class rgba {
r: number;
g: number;
b: number;
a: number;
constructor(r:number, g:number, b:number, a?:number){
this.r = r;
this.g = g;
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
Length(): number {
return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
}
Normalize(): Vec3 {
const len = this.Length();
if (len < 1e-9) {
return new Vec3(0, 0, 0);
}
return new Vec3(this.x / len, this.y / len, this.z / len);
}
DirectionToEuler(): Vec3 {
const normalized = this.Normalize();
if (normalized.Length() < 1e-9) {
return new Vec3(0, 0, 0);
}
const x = normalized.x;
const y = normalized.y;
const z = normalized.z;
const yaw = Math.atan2(-x, -z);
const horizontalLength = Math.sqrt(x * x + z * z);
const pitch = Math.atan2(y, horizontalLength);
const roll = 0;
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
function LerpVector(start: mod.Vector, end: mod.Vector, alpha: number): mod.Vector {
alpha = Math.max(0, Math.min(1, alpha));
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
interface RaycastResult {
hit: boolean;
ID: number
player?: mod.Player;
point: mod.Vector;
normal?: mod.Vector;
}
interface RaycastRequest {
player?: mod.Player;
id: number,
resolve: (result: RaycastResult) => void;
reject: (error: any) => void;
debug?: boolean;
debugDuration?: number;
start: mod.Vector;
stop: mod.Vector;
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
static cast(start: mod.Vector, stop: mod.Vector, debug: boolean = false, debugDuration: number = 5): Promise<RaycastResult> {
return new Promise<RaycastResult>(async (resolve, reject) => {
try {
if (!start || !stop) {
reject(new Error('RaycastManager.cast() requires valid start and stop vectors'));
return;
}
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
mod.RayCast(start, stop);
} catch (error) {
reject(error);
}
});
}
static castWithPlayer(player: mod.Player, start: mod.Vector, stop: mod.Vector, debug: boolean = false, debugDuration: number = 5): Promise<RaycastResult> {
return new Promise<RaycastResult>(async (resolve, reject) => {
try {
if (!start || !stop) {
reject(new Error('RaycastManager.castWithPlayer() requires valid start and stop vectors'));
return;
}
if (!player || !mod.IsPlayerValid(player)) {
reject(new Error('RaycastManager.castWithPlayer() requires a valid player'));
return;
}
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
mod.RayCast(player, start, stop);
} catch (error) {
reject(error);
}
});
}
async handleHit(player: mod.Player, point: mod.Vector, normal: mod.Vector): Promise<void> {
if(DEBUG_MODE) console.log("Start of handleHit");
if (this.queue.length === 0) {
if (DEBUG_MODE) {
console.log('Warning: Received OnRayCastHit but queue is empty');
}
return;
}
if(DEBUG_MODE) console.log("Popping raycast request");
const request = this.queue.shift()!;
if(DEBUG_MODE) {
const distanceTraveled = request.start && request.stop
? VectorLength(Math2.Vec3.FromVector(point).Subtract(Math2.Vec3.FromVector(request.start)).ToVector())
: 0;
console.log(`[Raycast ${request.id}] HIT - Start: ${request.start ? VectorToString(request.start) : "unknown"}, Hit: ${VectorToString(point)}, Distance: ${distanceTraveled.toFixed(2)}`);
}
if(DEBUG_MODE) console.log("Before raycast viz");
if (request.debug && request.start && request.stop) {
this.VisualizeRaycast(request.start, point, request.debugDuration || 5, true);
}
if(DEBUG_MODE) console.log("After raycast viz");
await mod.Wait(0);
request.resolve({
hit: true,
player: player,
point: point,
normal: normal,
ID: request.id
});
if(DEBUG_MODE) console.log("After raycast resolve");
}
async handleMiss(player: mod.Player): Promise<void> {
if (this.queue.length === 0) {
if (DEBUG_MODE) {
console.log('Warning: Received OnRayCastMissed but queue is empty');
}
return;
}
const request = this.queue.shift()!;
if(DEBUG_MODE) {
const rayLength = request.start && request.stop
? VectorLength(Math2.Vec3.FromVector(request.stop).Subtract(Math2.Vec3.FromVector(request.start)).ToVector())
: 0;
console.log(`[Raycast ${request.id}] MISS - Start: ${request.start ? VectorToString(request.start) : "unknown"}, End: ${request.stop ? VectorToString(request.stop) : "unknown"}, Length: ${rayLength.toFixed(2)}`);
}
if (request.debug && request.start && request.stop) {
this.VisualizeRaycast(request.start, request.stop, request.debugDuration || 5, false);
}
await mod.Wait(0);
request.resolve({
hit: false,
player: player,
point: request.stop,
ID: request.id
});
}
getQueueLength(): number {
return this.queue.length;
}
private async VisualizeRaycast(
start: mod.Vector,
end: mod.Vector,
debugDuration: number,
hit: boolean
): Promise<void> {
const rayVector = Math2.Vec3.FromVector(end).Subtract(Math2.Vec3.FromVector(start)).ToVector();
const rayLength = VectorLength(rayVector);
const numPoints = Math.max(2, Math.ceil(rayLength));
const points: mod.Vector[] = [];
for (let i = 0; i < numPoints; i++) {
const t = i / (numPoints - 1);
const point = mod.Add(start, mod.Multiply(rayVector, t));
points.push(point);
}
const rayColor = hit
? new rgba(0, 255, 0, 1).NormalizeToLinear().AsModVector3()
: new rgba(255, 255, 0, 1).NormalizeToLinear().AsModVector3();
const endColor = hit
? new rgba(255, 0, 0, 1).NormalizeToLinear().AsModVector3()
: new rgba(255, 0, 255, 1).NormalizeToLinear().AsModVector3();
this.VisualizePoints(points, rayColor, debugDuration);
this.VisualizePoints([end], endColor, debugDuration, [], hit ? mod.WorldIconImages.Cross : mod.WorldIconImages.Triangle);
}
async VisualizePoints(
points: mod.Vector[],
color?: mod.Vector,
debugDuration: number = 5,
rayIds?: number[],
iconImage?: mod.WorldIconImages
): Promise<void> {
const iconColor = color ?? new rgba(255, 255, 0, 1).NormalizeToLinear().AsModVector3();
const lastIconColor = color ?? new rgba(255, 0, 0, 1).NormalizeToLinear().AsModVector3();
const icon = iconImage ?? mod.WorldIconImages.Triangle;
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
if (debugDuration > 0) {
await mod.Wait(debugDuration);
for (const icon of icons) {
mod.UnspawnObject(icon);
}
}
}
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
let forwardHit: RaycastResult = {hit: false, ID:-1, point: ZERO_VEC};
if (direction) {
let forwardRayStart = mod.Add(startPosition, mod.Multiply(direction, 1));
let forwardRayEnd = mod.Add(forwardRayStart, mod.Multiply(direction, forwardDistance));
forwardHit = await RaycastManager.cast(forwardRayStart, forwardRayEnd);
highPosition = forwardHit.point ?? forwardRayEnd;
if (debug) {
const blueColor = new rgba(0, 0, 255, 1).NormalizeToLinear().AsModVector3();
await raycastManager.VisualizePoints([forwardRayStart, highPosition], blueColor, debugDuration);
}
if (DEBUG_MODE) {
console.log(`Forward raycast - Hit: ${forwardHit.hit}, Location: ${forwardHit.point ? VectorToString(forwardHit.point) : "none"}`);
}
}
let downwardRayStart = forwardHit.hit
? mod.Add(highPosition, mod.Multiply(direction, collisionRadius * -1))
: highPosition;
let downwardRayEnd = mod.Add(downwardRayStart, mod.Multiply(mod.DownVector(), downwardDistance));
let downHit = await RaycastManager.cast(downwardRayStart, downwardRayEnd);
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
const rayResult = player ? await this.castWithPlayer(player, currentPos, nextPos) : await RaycastManager.cast(currentPos, nextPos);
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
const segmentStart = currentPos;
const velocityAtSegmentStart = currentVelocity;
const gravityVec = mod.Multiply(mod.DownVector(), gravity * timeStep);
currentVelocity = mod.Add(currentVelocity, gravityVec);
const displacement = mod.Multiply(currentVelocity, timeStep);
const nextPos = mod.Add(currentPos, displacement);
if(DEBUG_MODE) {
console.log(`[ProjectileRaycastGenerator] Iteration ${iteration} - From: ${VectorToString(currentPos)} To: ${VectorToString(nextPos)}, TotalDist: ${totalDistance.toFixed(2)}`);
}
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
if (interpolationSteps > 0) {
const hitVector = Math2.Vec3.FromVector(rayResult.point).Subtract(Math2.Vec3.FromVector(segmentStart)).ToVector();
const hitDistance = VectorLength(hitVector);
const totalSegmentDistance = VectorLength(displacement);
const hitTimeFraction = totalSegmentDistance > 0 ? hitDistance / totalSegmentDistance : 0;
const hitTimeStep = hitTimeFraction * timeStep;
for (let i = 1; i <= interpolationSteps; i++) {
const t = i / (interpolationSteps + 1);
const subTimeStep = t * hitTimeStep;
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
if (onHitDetected && finalPosition !== rayResult.point) {
const adjustmentDistance = VectorLength(
Math2.Vec3.FromVector(finalPosition).Subtract(Math2.Vec3.FromVector(rayResult.point)).ToVector()
);
if (adjustmentDistance > 0.1 && interpolationSteps > 0) {
if(DEBUG_MODE) {
console.log(`[ProjectileRaycastGenerator] Generating ${interpolationSteps} adjustment points from hit to validated position (distance: ${adjustmentDistance.toFixed(2)})`);
}
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
yield {
position: finalPosition,
rayId: rayResult.ID,
hit: true,
hitNormal: rayResult.normal,
isLast: true
};
break;
}
if (interpolationSteps > 0) {
for (let i = 1; i <= interpolationSteps + 1; i++) {
const t = i / (interpolationSteps + 1);
const subTimeStep = t * timeStep;
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
yield {
position: nextPos,
rayId: rayResult.ID,
hit: false,
isLast: false
};
}
currentPos = nextPos;
console.log(`Before displacement vec: ${VectorToString(displacement)}`);
console.log(`After displacement vec length: ${VectorLength(displacement)}`);
totalDistance += VectorLength(displacement);
}
if (!hit) {
if(DEBUG_MODE) {
console.log(`[ProjectileRaycastGenerator] Complete - Reached distance limit at ${totalDistance.toFixed(2)}`);
}
}
if(DEBUG_MODE) {
console.log(`[ProjectileRaycastGenerator] Complete - Total iterations: ${iteration}, Final hit: ${hit}, Total distance: ${totalDistance.toFixed(2)}`);
}
}
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
const directions = RaycastManager.GenerateRadialDirections(numDirections);
for (let iteration = 0; iteration < maxIterations; iteration++) {
foundCollision = false;
let adjustmentVector = mod.CreateVector(0, 0, 0);
let collisionCount = 0;
for (const direction of directions) {
const rayStart = mod.Add(currentPosition, mod.Multiply(direction, checkRadiusOffset));
const rayEnd = mod.Add(currentPosition, mod.Multiply(direction, checkRadius));
const rayResult = await RaycastManager.cast(rayStart, rayEnd, debug);
if (rayResult.hit && rayResult.point) {
foundCollision = true;
collisionCount++;
const hitVector = Math2.Vec3.FromVector(rayResult.point).Subtract(Math2.Vec3.FromVector(rayStart)).ToVector();
const hitDistance = VectorLength(hitVector);
const penetrationDepth = checkRadius - hitDistance;
const pushAmount = penetrationDepth;
const pushVector = mod.Multiply(direction, -pushAmount);
adjustmentVector = mod.Add(adjustmentVector, pushVector);
if (DEBUG_MODE) {
console.log(` Iteration ${iteration}: Collision at distance ${hitDistance.toFixed(2)} (penetration: ${penetrationDepth.toFixed(2)}, push: ${pushAmount.toFixed(2)})`);
}
}
}
if (foundCollision && collisionCount > 0) {
if (collisionCount > 1) {
adjustmentVector = mod.Multiply(adjustmentVector, 1.0 / collisionCount);
}
currentPosition = mod.Add(currentPosition, adjustmentVector);
if (DEBUG_MODE) {
console.log(` Iteration ${iteration}: Adjusted position by ${VectorToString(adjustmentVector)}`);
console.log(` New position: ${VectorToString(currentPosition)}`);
}
} else {
if (DEBUG_MODE) {
console.log(` Iteration ${iteration}: No collisions, position is clear`);
}
break;
}
}
const downwardRayStart = mod.Add(currentPosition, mod.CreateVector(0, SPAWN_VALIDATION_HEIGHT_OFFSET, 0));
const downwardRayEnd = mod.Add(downwardRayStart, mod.Multiply(mod.DownVector(), downwardDistance));
const groundResult = await RaycastManager.cast(downwardRayStart, downwardRayEnd, debug);
console.log(`Looking for spawn location using downward ray start: ${VectorToString(downwardRayStart)}, ray end: ${VectorToString(downwardRayEnd)}`);
let finalPosition = currentPosition;
let isValid = true;
if (groundResult.hit && groundResult.point) {
finalPosition = mod.CreateVector(
mod.XComponentOf(currentPosition),
mod.YComponentOf(groundResult.point),
mod.ZComponentOf(currentPosition)
);
if (DEBUG_MODE) {
console.log(` Ground found at ${VectorToString(finalPosition)}`);
console.log(` Preserved adjusted position: X=${mod.XComponentOf(currentPosition).toFixed(6)}, Z=${mod.ZComponentOf(currentPosition).toFixed(6)}`);
}
} else {
isValid = false;
if (DEBUG_MODE) {
console.log(` WARNING: No ground found below position`);
}
}
if (foundCollision && DEBUG_MODE) {
console.log(` Note: Still have some collisions after ${maxIterations} iterations, but using adjusted position anyway`);
}
return {
position: finalPosition,
isValid: isValid
};
}
}
const raycastManager = new RaycastManager();
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
interface ProjectilePoint {
position: mod.Vector;
rayId: number;
hit: boolean;
hitNormal?: mod.Vector;
isLast: boolean;
}
interface AnimationOptions {
speed?: number;
duration?: number;
rotateToDirection?: boolean;
rotation?: mod.Vector;
rotationSpeed?: number;
loop?: boolean;
reverse?: boolean;
onSpawnAtStart?: () => mod.Object | null;
onStart?: () => void;
onProgress?: (progress: number, position: mod.Vector) => void;
onComplete?: () => void;
onSegmentComplete?: (segmentIndex: number) => void;
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
const animation: ActiveAnimation = {
object,
objectId,
cancelled: false,
paused: false,
progress: 0
};
this.activeAnimations.set(objectId, animation);
let expectedPosition = points[0];
try {
let totalDistance = 0;
for (let i = 0; i < points.length - 1; i++) {
totalDistance += VectorLength(Math2.Vec3.FromVector(points[i + 1]).Subtract(Math2.Vec3.FromVector(points[i])).ToVector());
}
let totalDuration: number;
if (options.duration !== undefined) {
totalDuration = options.duration;
} else if (options.speed !== undefined) {
totalDuration = totalDistance / options.speed;
} else {
totalDuration = totalDistance;
}
let elapsedTime = 0;
for (let i = 0; i < points.length - 1; i++) {
if (animation.cancelled) break;
const startPoint = expectedPosition;
const endPoint = points[i + 1];
const segmentDistance = VectorLength(Math2.Vec3.FromVector(endPoint).Subtract(Math2.Vec3.FromVector(startPoint)).ToVector());
const segmentDuration = (segmentDistance / totalDistance) * totalDuration;
let rotation = ZERO_VEC;
if (options.rotateToDirection) {
rotation = this.CalculateRotationFromDirection(
Math2.Vec3.FromVector(endPoint).Subtract(Math2.Vec3.FromVector(startPoint)).ToVector()
);
}
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
if (!animation.cancelled) {
if (options.reverse) {
const reversedPoints = [...points].reverse();
await this.AnimateAlongPath(object, reversedPoints, {
...options,
reverse: false
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
const positionDelta = Math2.Vec3.FromVector(endPos).Subtract(Math2.Vec3.FromVector(startPos)).ToVector();
const rotationDelta = options.rotation || ZERO_VEC;
if (DEBUG_MODE) {
console.log(`=== Animation Segment Debug ===`);
console.log(`Start pos (tracked): X:${mod.XComponentOf(startPos).toFixed(6)}, Y:${mod.YComponentOf(startPos).toFixed(6)}, Z:${mod.ZComponentOf(startPos).toFixed(6)}`);
console.log(`End pos (target): X:${mod.XComponentOf(endPos).toFixed(6)}, Y:${mod.YComponentOf(endPos).toFixed(6)}, Z:${mod.ZComponentOf(endPos).toFixed(6)}`);
console.log(`Position delta: X:${mod.XComponentOf(positionDelta).toFixed(6)}, Y:${mod.YComponentOf(positionDelta).toFixed(6)}, Z:${mod.ZComponentOf(positionDelta).toFixed(6)}`);
console.log(`Rotation delta: X:${mod.XComponentOf(rotationDelta).toFixed(6)}, Y:${mod.YComponentOf(rotationDelta).toFixed(6)}, Z:${mod.ZComponentOf(rotationDelta).toFixed(6)}`);
}
mod.SetObjectTransform(object, mod.CreateTransform(endPos, options.rotation));
await mod.Wait(duration);
}
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
private CalculateRotationFromDirection(direction: mod.Vector): mod.Vector {
const normalized = mod.Normalize(direction);
const x = mod.XComponentOf(normalized);
const y = mod.YComponentOf(normalized);
const z = mod.ZComponentOf(normalized);
const yaw = Math.atan2(x, -z);
const horizontalDist = Math.sqrt(x * x + z * z);
const pitch = Math.atan2(y, horizontalDist);
return mod.CreateVector(pitch, yaw, 0);
}
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
if(DEBUG_MODE) console.log(`[AnimateAlongGeneratedPath] Starting concurrent animation with buffer size ${minBufferSize}`);
const initialBufferSize = minBufferSize;
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
currentPosition = pointBuffer[0].position;
if(DEBUG_MODE) {
console.log(`[AnimateAlongGeneratedPath] Initial buffer filled with ${pointBuffer.length} points, starting animation`);
}
animationStarted = true;
let segmentIndex = 0;
let animation: ActiveAnimation;
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
objectId = object ? mod.GetObjId(object) : -1;
animation = {
object,
objectId,
cancelled: false,
paused: false,
progress: 0
}
this.activeAnimations.set(objectId, animation);
if(options.onStart)
options.onStart();
while (pointBuffer.length > 1 || !generatorComplete) {
if (animation.cancelled) break;
if (pointBuffer.length <= minBufferSize && !generatorComplete) {
if(DEBUG_MODE) {
console.log(`[AnimateAlongGeneratedPath] Buffer low (${pointBuffer.length} points), waiting for generator...`);
}
bufferStarvationCount++;
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
if (!generatorComplete && pointBuffer.length < initialBufferSize * 2) {
const result = await generator.next();
if (result.done) {
generatorComplete = true;
if(DEBUG_MODE) console.log(`[AnimateAlongGeneratedPath] Generator completed`);
} else {
pointBuffer.push(result.value);
}
}
const shouldStopConsuming = generatorComplete && pointBuffer.length <= minBufferSize + 2;
if (shouldStopConsuming) {
if(DEBUG_MODE) {
console.log(`[AnimateAlongGeneratedPath] Stopping animation consumption, ${pointBuffer.length} points remaining in buffer`);
}
break;
}
if (pointBuffer.length > 1) {
const startPoint = pointBuffer.shift()!;
const endPoint = pointBuffer[0];
const segmentDistance = VectorLength(
Math2.Vec3.FromVector(endPoint.position)
.Subtract(Math2.Vec3.FromVector(startPoint.position))
.ToVector()
);
const segmentDuration = options.speed ? segmentDistance / options.speed : 0.1;
if(DEBUG_MODE) {
console.log(`[AnimateAlongGeneratedPath] Animating segment ${segmentIndex}: ${VectorToString(startPoint.position)} -> ${VectorToString(endPoint.position)} (${segmentDistance.toFixed(2)} units, ${segmentDuration.toFixed(3)}s, buffer: ${pointBuffer.length})`);
}
let rotation = ZERO_VEC;
if (options.rotateToDirection) {
rotation = this.CalculateRotationFromDirection(
Math2.Vec3.FromVector(endPoint.position)
.Subtract(Math2.Vec3.FromVector(startPoint.position))
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
options.onProgress(segmentIndex / (segmentIndex + pointBuffer.length), currentPosition);
}
if (options.onSegmentComplete) {
options.onSegmentComplete(segmentIndex);
}
}
}
if (pointBuffer.length > 0) {
if(DEBUG_MODE) {
console.log(`[AnimateAlongGeneratedPath] Animating through ${pointBuffer.length} remaining buffered points`);
}
while (pointBuffer.length > 0) {
const startPoint = pointBuffer.shift()!;
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
if(objectId > -1)
this.activeAnimations.delete(objectId);
}
}
StopAnimation(object: mod.Object): void {
const objectId = mod.GetObjId(object);
const animation = this.activeAnimations.get(objectId);
if (animation) {
animation.cancelled = true;
mod.StopActiveMovementForObject(object);
this.activeAnimations.delete(objectId);
}
}
IsAnimating(object: mod.Object): boolean {
const objectId = mod.GetObjId(object);
return this.activeAnimations.has(objectId);
}
GetAnimationProgress(object: mod.Object): number {
const objectId = mod.GetObjId(object);
const animation = this.activeAnimations.get(objectId);
return animation ? animation.progress : 0;
}
PauseAnimation(object: mod.Object): void {
const objectId = mod.GetObjId(object);
const animation = this.activeAnimations.get(objectId);
if (animation) {
animation.paused = true;
mod.StopActiveMovementForObject(object);
}
}
ResumeAnimation(object: mod.Object): void {
const objectId = mod.GetObjId(object);
const animation = this.activeAnimations.get(objectId);
if (animation) {
animation.paused = false;
}
}
StopAllAnimations(): void {
for (const [objectId, animation] of this.activeAnimations.entries()) {
animation.cancelled = true;
if(animation.object)
mod.StopActiveMovementForObject(animation.object);
}
this.activeAnimations.clear();
}
}
const animationManager = new AnimationManager();
type EventHandler<T = any> = (data: T) => void;
class EventDispatcher<TEventMap = Record<string, any>> {
private listeners: Map<string, Set<EventHandler>> = new Map();
on<K extends keyof TEventMap>(event: K, callback: EventHandler<TEventMap[K]>): () => void {
const eventName = event as string;
if (!this.listeners.has(eventName)) {
this.listeners.set(eventName, new Set());
}
this.listeners.get(eventName)!.add(callback);
return () => this.off(event, callback);
}
off<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
const eventName = event as string;
const handlers = this.listeners.get(eventName);
if (handlers) {
handlers.delete(handler);
if (handlers.size === 0) {
this.listeners.delete(eventName);
}
}
}
once<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
const onceWrapper: EventHandler<TEventMap[K]> = (data) => {
handler(data);
this.off(event, onceWrapper);
};
this.on(event, onceWrapper);
}
emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]): void {
const eventName = event as string;
const handlers = this.listeners.get(eventName);
if (handlers) {
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
hasListeners<K extends keyof TEventMap>(event: K): boolean {
const eventName = event as string;
const handlers = this.listeners.get(eventName);
return handlers ? handlers.size > 0 : false;
}
listenerCount<K extends keyof TEventMap>(event: K): number {
const eventName = event as string;
const handlers = this.listeners.get(eventName);
return handlers ? handlers.size : 0;
}
clear<K extends keyof TEventMap>(event?: K): void {
if (event !== undefined) {
const eventName = event as string;
this.listeners.delete(eventName);
} else {
this.listeners.clear();
}
}
eventNames(): string[] {
return Array.from(this.listeners.keys());
}
}
import * as modlib from 'modlib';
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
const TEAM_ID_START_OFFSET = 100;
const TEAM_ID_STRIDE_OFFSET = 10;
let gameStarted = false;
interface PlayerEventMap {
'playerJoined': { player: mod.Player };
'playerLeft': { playerId: number };
}
const globalPlayerEvents = new EventDispatcher<PlayerEventMap>();
let lastBalanceCheckTime = 0;
let balanceInProgress = false;
let teamNeutral: mod.Team;
let team1: mod.Team;
let team2: mod.Team;
let team3: mod.Team;
let team4: mod.Team;
let lastTickTime: number = 0;
let lastSecondUpdateTime: number = 0;
const ZERO_VEC = mod.CreateVector(0, 0, 0);
const ONE_VEC = mod.CreateVector(1, 1, 1);
let teams: Map<number, mod.Team> = new Map();
let teamConfigs: Map<number, TeamConfig> = new Map();
let teamScores: Map<number, number> = new Map();
let flags: Map<number, Flag> = new Map();
let captureZones: Map<number, CaptureZone> = new Map();
let worldIconManager: WorldIconManager;
let vfxManager: VFXManager;
function PositionTeamHUD(teamId: number): void {
let globalHUD = GlobalScoreboardHUD.getInstance().getHUD();
if (!globalHUD?.rootWidget) return;
let globalHUDPos = mod.GetUIWidgetPosition(globalHUD.rootWidget);
let globalHUDSize = mod.GetUIWidgetSize(globalHUD.rootWidget);
let teamHUD = TeamScoreboardHUD.getInstance(teamId);
if (!teamHUD?.rootWidget) return;
let teamHUDPos = mod.GetUIWidgetPosition(teamHUD.rootWidget);
let offsetBarY = mod.YComponentOf(globalHUDPos) + mod.YComponentOf(globalHUDSize) + 10;
mod.SetUIWidgetPosition(
teamHUD.rootWidget,
mod.CreateVector(mod.XComponentOf(teamHUDPos), offsetBarY, 0)
);
if (DEBUG_MODE) {
console.log(`Positioned team ${teamId} HUD at Y offset: ${offsetBarY}`);
}
}
function InitializeUIHierarchy(): void {
const globalHUD = GlobalScoreboardHUD.getInstance();
if (currentHUDClass) {
globalHUD.createGlobalHUD(currentHUDClass);
if (DEBUG_MODE) {
console.log(`InitializeUIHierarchy: Created global HUD with ${currentHUDClass.name}`);
}
}
for (const [teamId, team] of teams.entries()) {
if (teamId === 0) continue;
TeamScoreboardHUD.create(team);
PositionTeamHUD(teamId);
if (DEBUG_MODE) {
console.log(`InitializeUIHierarchy: Created team HUD for team ${teamId}`);
}
}
if (DEBUG_MODE) {
console.log(`InitializeUIHierarchy: UI hierarchy initialized (Global + ${teams.size - 1} team HUDs)`);
}
}
export async function OnGameModeStarted() {
console.log(`CTF Game Mode v${VERSION[0]}.${VERSION[1]}.${VERSION[2]} Started`);
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_version_author));
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_version_started, VERSION[0], VERSION[1], VERSION[2]));
worldIconManager = WorldIconManager.getInstance();
vfxManager = VFXManager.getInstance();
teamNeutral = mod.GetTeam(TeamID.TEAM_NEUTRAL);
team1 = mod.GetTeam(TeamID.TEAM_1);
team2 = mod.GetTeam(TeamID.TEAM_2);
team3 = mod.GetTeam(TeamID.TEAM_3);
team4 = mod.GetTeam(TeamID.TEAM_4);
await mod.Wait(1);
let gameModeID = -1;
let activeConfig: GameModeConfig | undefined = undefined;
for(let [configID, config] of DEFAULT_GAMEMODES){
let gameModeConfigObj = mod.GetSpatialObject(configID);
let gameModeExistsFallbackPos = mod.GetObjectPosition(gameModeConfigObj);
let isAtOrigin = AreVectorsEqual(gameModeExistsFallbackPos, ZERO_VEC, 0.1);
if(DEBUG_MODE)
console.log(`currentModeId: ${configID}, gameModeConfigObj: ${gameModeConfigObj}, is at origin: ${isAtOrigin}, position: ${VectorToString(gameModeExistsFallbackPos)}`);
if(gameModeConfigObj && !isAtOrigin){
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
let players = mod.AllPlayers();
let numPlayers = mod.CountOf(players);
for (let i = 0; i < numPlayers; i++) {
let loopPlayer = mod.ValueInArray(players, i);
if(mod.IsPlayerValid(loopPlayer)){
JSPlayer.get(loopPlayer);
}
}
gameStarted = true;
InitializeUIHierarchy();
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
for (const [flagId, flag] of flags.entries()) {
flag.FastUpdate(timeDelta);
}
GlobalScoreboardHUD.getInstance().refresh();
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
if (TEAM_AUTO_BALANCE) {
CheckAndBalanceTeams();
}
RefreshScoreboard();
if (mod.GetMatchTimeRemaining() <= 0) {
EndGameByTime();
}
for(let [flagID, flag] of flags){
flag.SlowUpdate(timeDelta);
}
lastSecondUpdateTime = currentTime;
}
}
async function FixTeamScopedUIVisibility(player: mod.Player): Promise<void> {
const playerTeam = mod.GetTeam(player);
const playerTeamId = mod.GetObjId(playerTeam);
if (playerTeamId === 0) return;
if (DEBUG_MODE) {
console.log(`Rebuilding team UI for team ${playerTeamId} (player ${mod.GetObjId(player)} joined)`);
}
const existingHUD = TeamScoreboardHUD.getInstance(playerTeamId);
if (existingHUD) {
existingHUD.close();
}
TeamScoreboardHUD.create(playerTeam);
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
globalPlayerEvents.emit('playerJoined', { player: eventPlayer });
RefreshScoreboard();
}
export function OnPlayerLeaveGame(playerId: number): void {
for (const [flagId, flagData] of flags.entries()) {
if (flagData.carrierPlayer && mod.GetObjId(flagData.carrierPlayer) === playerId) {
flagData.DropFlag(flagData.currentPosition);
}
}
if (DEBUG_MODE) {
console.log(`Player left: ${playerId}`);
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_left, playerId));
}
JSPlayer.removeInvalidJSPlayers(playerId);
}
export function OnPlayerDeployed(eventPlayer: mod.Player): void {
if (DEBUG_MODE) {
const teamId = mod.GetObjId(mod.GetTeam(eventPlayer));
}
let jsPlayer = JSPlayer.get(eventPlayer);
if (jsPlayer && !jsPlayer.hasEverDeployed) {
jsPlayer.hasEverDeployed = true;
if (DEBUG_MODE) {
console.log(`Player ${mod.GetObjId(eventPlayer)} deployed for the first time - refreshing WorldIcons, VFX, and UI`);
}
worldIconManager.refreshAllIcons();
vfxManager.refreshAllVFX();
FixTeamScopedUIVisibility(eventPlayer);
}
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
if(DEBUG_MODE)
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_died, eventPlayer));
let killer = JSPlayer.get(eventOtherPlayer);
if(killer){
if(IsCarryingAnyFlag(eventPlayer) || WasCarryingAnyFlag(eventPlayer))
killer.score.flag_carrier_kills += 1;
else
killer.score.kills += 1;
}
DropAllFlags(eventPlayer);
}
export function OnPlayerInteract(
eventPlayer: mod.Player,
eventInteractPoint: mod.InteractPoint
): void {
const interactId = mod.GetObjId(eventInteractPoint);
const playerTeamId = mod.GetObjId(mod.GetTeam(eventPlayer));
for(let flag of flags){
let flagData = flag[1];
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
}
}
export function OnPlayerEnterVehicle(
eventPlayer: mod.Player,
eventVehicle: mod.Vehicle
): void {
if(DEBUG_MODE)
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.debug_player_enter_vehicle));
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
if (IsCarryingAnyFlag(eventPlayer) && VEHICLE_BLOCK_CARRIER_DRIVING) {
if (mod.GetPlayerVehicleSeat(eventPlayer) === VEHICLE_DRIVER_SEAT) {
if (DEBUG_MODE) console.log("Flag carrier in driver seat, forcing to passenger");
ForceToPassengerSeat(eventPlayer, eventVehicle);
}
}
}
export function OnGameModeEnding(): void {
gameStarted = false;
console.log("CTF: Game ending");
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_ending))
}
function ForceToPassengerSeat(player: mod.Player, vehicle: mod.Vehicle): void {
const seatCount = mod.GetVehicleSeatCount(vehicle);
let forcedToSeat = false;
let lastSeat = seatCount - 1;
for (let i = seatCount-1; i >= VEHICLE_FIRST_PASSENGER_SEAT; --i) {
if (!mod.IsVehicleSeatOccupied(vehicle, i)) {
mod.ForcePlayerToSeat(player, vehicle, i);
forcedToSeat = true;
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.forced_to_seat), player);
if (DEBUG_MODE) console.log(`Forced flag carrier to seat ${i}`);
return;
}
}
if (!mod.IsVehicleSeatOccupied(vehicle, lastSeat)) {
mod.ForcePlayerToSeat(player, vehicle, lastSeat);
forcedToSeat = true;
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.forced_to_seat), player);
if (DEBUG_MODE) console.log(`Forced flag carrier to seat ${lastSeat}`);
return;
}
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.no_passenger_seats, player));
mod.ForcePlayerExitVehicle(player, vehicle);
if (DEBUG_MODE) console.log("No passenger seats available, forcing exit");
}
function GetCurrentTime(): number {
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
function GetOpposingTeams(teamId: number): number[] {
const opposing: number[] = [];
for (const [id, team] of teams.entries()) {
if (id !== teamId && id !== 0) {
opposing.push(id);
}
}
return opposing;
}
function GetTeamColorById(teamId: number): mod.Vector {
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
return mod.Add(GetTeamColor(team), mod.CreateVector(0.5, 0.5, 0.5));
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
readonly player: mod.Player;
readonly playerId: number;
score: PlayerScore;
readonly joinOrder: number;
heldFlags: Flag[] = [];
hasEverDeployed: boolean = false;
lastPosition: mod.Vector = ZERO_VEC;
velocity: mod.Vector = ZERO_VEC;
scoreboardUI?: BaseScoreboardHUD;
static playerInstances: mod.Player[] = [];
static #allJsPlayers: { [key: number]: JSPlayer } = {};
static #nextJoinOrder: number = 0;
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
if(!this.scoreboardUI){
if (!mod.GetSoldierState(this.player, mod.SoldierStateBool.IsAISoldier)) {
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
delete this.#allJsPlayers[invalidPlayerId];
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
let scoringTeamId = mod.GetObjId(scoringTeam);
let currentScore = teamScores.get(scoringTeamId) ?? 0;
currentScore++;
teamScores.set(scoringTeamId, currentScore);
mod.SetGameModeScore(scoringTeam, currentScore);
if (DEBUG_MODE) {
console.log(`Team ${scoringTeamId} scored! New score: ${currentScore}`);
}
const scoringTeamFlag = flags.get(scoringTeamId);
if (scoringTeamFlag) {
CaptureFeedback(capturedFlag.currentPosition);
let captureSfxOwner: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_EnemyCapturedCache_OneShot2D, scoringTeamFlag.homePosition, ZERO_VEC);
mod.PlaySound(captureSfxOwner, 1, scoringTeamFlag.team);
let captureSfxCapturer: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_FriendlyCapturedCache_OneShot2D, scoringTeamFlag.homePosition, ZERO_VEC);
mod.PlaySound(captureSfxCapturer, 1, mod.GetTeam(scoringTeamId));
let capturingTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, scoringTeamFlag.homePosition, ZERO_VEC);
if(capturingTeamVO){
let vo_flag = DEFAULT_TEAM_VO_FLAGS.get(capturedFlag.teamId);
mod.PlayVO(capturingTeamVO, mod.VoiceOverEvents2D.ObjectiveCaptured, vo_flag ?? mod.VoiceOverFlags.Alpha, scoringTeam);
}
}
GetCarriedFlags(scoringPlayer).forEach((flag:Flag) => {
flag.events.emit("flagCaptured", {flag});
flag.ResetFlag();
});
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
}
async function CaptureFeedback(pos: mod.Vector): Promise<void> {
let vfx: mod.VFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Vehicle_Car_Destruction_Death_Explosion_PTV, pos, ZERO_VEC);
let sfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Standoff_ZoneCaptured_OneShot2D, pos, ZERO_VEC);
mod.PlaySound(sfx, 1.5);
await mod.Wait(1.1);
mod.EnableVFX(vfx, true);
await mod.Wait(5);
mod.UnspawnObject(sfx);
mod.UnspawnObject(vfx);
}
interface FlagEventMap {
'flagTaken': {
flag: Flag;
player: mod.Player;
isAtHome: boolean;
};
'flagDropped': {
flag: Flag;
position: mod.Vector;
previousCarrier: mod.Player | null;
};
'flagReturned': {
flag: Flag;
wasAutoReturned: boolean;
};
'flagAtHome': {
flag: Flag;
};
'flagStateChanged': {
flag: Flag;
isAtHome: boolean;
isBeingCarried: boolean;
isDropped: boolean;
};
'flagCaptured': {
flag: Flag;
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
currentPosition: mod.Vector;
followPoints: mod.Vector[];
followDelay: number;
smoothedPosition: mod.Vector;
smoothedRotation: mod.Vector;
isAtHome: boolean = true;
isBeingCarried: boolean = false;
isDropped: boolean = false;
canBePickedUp: boolean = true;
numFlagTimesPickedUp:number = 0;
carrierPlayer: mod.Player | null = null;
lastCarrier: mod.Player | null = null;
dropTime: number = 0;
autoReturnTime: number = 0;
flagRecoverIcon: mod.WorldIcon;
flagCarriedIcons: Map<number, mod.WorldIcon> = new Map();
flagInteractionPoint: mod.InteractPoint | null = null;
flagProp: mod.Object | null = null;
recoverIconId: string = '';
carriedIconIds: Map<number, string> = new Map();
flagSmokeVFX: mod.VFX;
tetherFlagVFX: mod.VFX | null = null;
tetherPlayerVFX: mod.VFX | null = null;
hoverVFX: mod.VFX | null = null;
pickupChargingVFX: mod.VFX | null = null;
pickupAvailableVFX: mod.VFX | null = null;
flagImpactVFX: mod.VFX | null = null;
flagSparksVFX: mod.VFX | null = null;
smokeVFXId: string = '';
sparksVFXId: string = '';
impactVFXId: string = '';
alarmSFX : mod.SFX | null = null;
dragSFX: mod.SFX | null = null;
pickupTimerStartSFX:mod.SFX | null = null;
pickupTimerRiseSFX:mod.SFX | null = null;
pickupTimerStopSFX:mod.SFX | null = null;
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
this.flagId = flagId ?? this.teamId;
this.allowedCapturingTeams = allowedCapturingTeams ?? [];
this.customColor = customColor;
this.homePosition = homePosition;
this.currentPosition = homePosition;
this.smoothedPosition = homePosition;
this.smoothedRotation = ZERO_VEC;
this.followPoints = [];
this.followDelay = 10;
this.flagInteractionPoint = null;
this.flagRecoverIcon = null as any;
this.flagProp = null;
this.flagSmokeVFX = null as any;
this.dragSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Levels_Brooklyn_Shared_Spots_MetalStress_OneShot3D, this.homePosition, ZERO_VEC);
this.hoverVFX = null;
this.pickupChargingVFX = null;
this.pickupAvailableVFX = null;
this.flagImpactVFX = null as any;
this.flagSparksVFX = null as any;
this.pickupTimerStartSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_AltRecoveringCacheStart_OneShot2D, this.homePosition, ZERO_VEC);
this.pickupTimerRiseSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_AltRecoveringCacheTimer_OneShot2D, this.homePosition, ZERO_VEC);
this.pickupTimerStopSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_AltRecoveringCacheStop_OneShot2D, this.homePosition, ZERO_VEC);
this.events = new EventDispatcher<FlagEventMap>();
this.Initialize();
}
Initialize(): void {
const iconMgr = worldIconManager;
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
const vfxMgr = vfxManager;
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
this.sparksVFXId = `flag_${this.flagId}_sparks`;
this.flagSparksVFX = vfxMgr.createVFX(
this.sparksVFXId,
mod.RuntimeSpawn_Common.FX_BASE_Sparks_Pulse_L,
this.homePosition,
ZERO_VEC,
{
enabled: false
}
);
this.impactVFXId = `flag_${this.flagId}_impact`;
this.flagImpactVFX = vfxMgr.createVFX(
this.impactVFXId,
mod.RuntimeSpawn_Common.FX_Impact_LootCrate_Generic,
this.homePosition,
ZERO_VEC,
{
enabled: false
}
);
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
let flagOffset = mod.CreateVector(0.0, 0.1, 0.0);
if (this.flagProp && mod.GetObjId(this.flagProp) > 0) {
mod.UnspawnObject(this.flagProp);
}
const vfxMgr = vfxManager;
vfxMgr.setColor(this.smokeVFXId, GetTeamColor(this.team));
vfxMgr.setEnabled(this.smokeVFXId, true);
vfxMgr.setPosition(this.smokeVFXId, this.currentPosition, ZERO_VEC);
this.flagProp = mod.SpawnObject(
FLAG_PROP,
mod.Add(this.homePosition, flagOffset),
ZERO_VEC
);
let mcom: mod.MCOM = this.flagProp as mod.MCOM;
if(mcom)
mod.EnableGameModeObjective(mcom, false);
const iconMgr = worldIconManager;
for (const [teamId, iconId] of this.carriedIconIds.entries()) {
iconMgr.setColor(iconId, GetTeamColor(this.team));
iconMgr.setIcon(iconId, mod.WorldIconImages.Flag);
iconMgr.setText(iconId, mod.Message(mod.stringkeys.pickup_flag_label));
iconMgr.setEnabled(iconId, false, false);
}
iconMgr.setColor(this.recoverIconId, GetTeamColor(this.team));
iconMgr.setIcon(this.recoverIconId, mod.WorldIconImages.Flag);
iconMgr.setText(this.recoverIconId, mod.Message(mod.stringkeys.recover_flag_label));
iconMgr.setEnabled(this.recoverIconId, false, false);
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
const wasAtHome = this.isAtHome;
if(this.isAtHome){
this.PlayFlagAlarm().then(() => console.log("Flag alarm stopped"));
}
this.numFlagTimesPickedUp += 1;
this.isAtHome = false;
this.isBeingCarried = true;
this.isDropped = false;
this.carrierPlayer = player;
this.lastCarrier = player;
this.PlayFlagTakenVO();
let pickupSfxOwner: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_EnemyPickedUpCache_OneShot2D, this.homePosition, ZERO_VEC);
mod.PlaySound(pickupSfxOwner, 1, this.team);
for(let teamID of GetOpposingTeamsForFlag(this)){
let pickupSfxCapturer: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_FriendlyCapturedCache_OneShot2D, this.homePosition, ZERO_VEC);
mod.PlaySound(pickupSfxCapturer, 1, mod.GetTeam(teamID));
}
if(this.pickupAvailableVFX){
mod.EnableVFX(this.pickupAvailableVFX, false);
}
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
this.followPoints = [];
this.RestrictCarrierWeapons(player);
mod.SpotTarget(this.carrierPlayer, mod.SpotStatus.SpotInMinimap);
const iconMgr = worldIconManager;
for (const [teamId, iconId] of this.carriedIconIds.entries()) {
iconMgr.setEnabled(iconId, true, true);
}
iconMgr.setEnabled(this.recoverIconId, true, true);
vfxManager.setColor(this.smokeVFXId, GetTeamColor(this.team));
const message = mod.Message(mod.stringkeys.team_flag_taken, GetTeamName(this.team));
if(DEBUG_MODE)
mod.DisplayHighlightedWorldLogMessage(message);
if(this.flagInteractionPoint){
mod.UnspawnObject(this.flagInteractionPoint);
}
this.events.emit('flagTaken', {
flag: this,
player: player,
isAtHome: wasAtHome
});
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
const previousCarrier = this.carrierPlayer;
this.isAtHome = false;
this.isBeingCarried = false;
this.isDropped = true;
this.canBePickedUp = false;
useProjectileThrow = useProjectileThrow ?? FLAG_ENABLE_ARC_THROW;
let facingDir: mod.Vector = ZERO_VEC;
let throwDirectionAndSpeed: mod.Vector = ZERO_VEC;
let startRaycastID: number = RaycastManager.GetID();
if(this.carrierPlayer){
let soldierPosition = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetPosition);
facingDir = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetFacingDirection);
position = position ?? soldierPosition;
direction = direction ?? mod.Normalize(mod.CreateVector(mod.XComponentOf(facingDir), 0, mod.ZComponentOf(facingDir)));
let jsPlayer = JSPlayer.get(this.carrierPlayer);
if(jsPlayer){
throwDirectionAndSpeed = mod.Add(mod.Multiply(facingDir, FLAG_THROW_SPEED), jsPlayer.velocity);
}
this.RestoreCarrierWeapons(this.carrierPlayer);
mod.RemoveUIIcon(this.carrierPlayer);
mod.SpotTarget(this.carrierPlayer, mod.SpotStatus.Unspot);
} else {
position = position ?? this.currentPosition;
direction = direction ?? mod.DownVector();
throwDirectionAndSpeed = mod.Multiply(direction, FLAG_THROW_SPEED);
}
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
let flagRotationVec = Math2.Vec3.FromVector(facingDir).DirectionToEuler();
let flagRotationFlat = new Math2.Vec3(0, flagRotationVec.y, 0);
let flagRotation = flagRotationFlat.ToVector();
let initialPosition = position;
if(!FLAG_FOLLOW_MODE){
}
if(DEBUG_MODE) console.log("this.flagProp = mod.SpawnObject(FLAG_PROP, initialPosition, flagRotation);");
let yeetSfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Soldier_Ragdoll_OnDeath_OneShot3D, initialPosition, ZERO_VEC);
mod.PlaySound(yeetSfx, 1);
this.carrierPlayer = null;
if(useProjectileThrow && !FLAG_FOLLOW_MODE) {
if(DEBUG_MODE) console.log("Starting concurrent flag animation");
const pathGenerator = RaycastManager.ProjectileRaycastGenerator(
mod.Add(
mod.Add(mod.Add(position, mod.CreateVector(0.0, SOLDIER_HEIGHT, 0.0)), mod.Multiply(facingDir, 1.5)) ,
mod.Multiply(facingDir, 0.75)
),
throwDirectionAndSpeed,
FLAG_DROP_RAYCAST_DISTANCE,
4,
this.carrierPlayer,
9.8,
DEBUG_MODE,
5,
FLAG_TERRAIN_FIX_PROTECTION ? mod.YComponentOf(initialPosition) : undefined,
async (hitPoint: mod.Vector, hitNormal?: mod.Vector) => {
if(DEBUG_MODE) {
console.log(`[DropFlag] Hit detected at ${VectorToString(hitPoint)}, validating position`);
}
let groundLocationAdjusted: mod.Vector = mod.Add(
hitPoint,
mod.Multiply(hitNormal ?? mod.UpVector(), SPAWN_VALIDATION_HEIGHT_OFFSET)
);
const validatedFlagSpawn = await RaycastManager.ValidateSpawnLocationWithRadialCheck(
groundLocationAdjusted,
FLAG_COLLISION_RADIUS,
FLAG_COLLISION_RADIUS_OFFSET,
SPAWN_VALIDATION_DIRECTIONS,
FLAG_DROP_RAYCAST_DISTANCE,
SPAWN_VALIDATION_MAX_ITERATIONS,
DEBUG_MODE,
FLAG_TERRAIN_FIX_PROTECTION ? mod.YComponentOf(initialPosition) : undefined
);
let endRayCastID: number = RaycastManager.GetID();
if(DEBUG_MODE){
console.log(`Flag drop took ${endRayCastID - startRaycastID} raycasts to complete`);
if (!validatedFlagSpawn.isValid) {
console.log(`Warning: ValidateSpawnLocationWithRadialCheck could not find valid location`);
}
}
return validatedFlagSpawn.isValid ? validatedFlagSpawn.position : hitPoint;
}
);
await animationManager.AnimateAlongGeneratedPath(
undefined,
pathGenerator,
20,
{
speed: 800,
onSpawnAtStart: ():mod.Object | null => {
vfxManager.setEnabled(this.smokeVFXId, false);
this.flagProp = mod.SpawnObject(FLAG_PROP, initialPosition, flagRotation);
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
this.currentPosition = this.flagProp ? mod.GetObjectPosition(this.flagProp) : position;
if(DEBUG_MODE) console.log("Concurrent flag animation complete");
} else if(!useProjectileThrow) {
this.currentPosition = position;
if(this.flagProp) {
mod.SetObjectTransform(this.flagProp, mod.CreateTransform(this.currentPosition, flagRotation));
}
}
vfxManager.setPosition(this.impactVFXId, this.currentPosition, ZERO_VEC);
vfxManager.setEnabled(this.impactVFXId, true);
const iconMgr = worldIconManager;
let flagIconOffset = mod.Add(this.currentPosition, mod.CreateVector(0,2,0));
for (const [teamId, iconId] of this.carriedIconIds.entries()) {
iconMgr.setEnabled(iconId, true, true);
iconMgr.setText(iconId, mod.Message(mod.stringkeys.pickup_flag_label));
iconMgr.setPosition(iconId, flagIconOffset);
}
iconMgr.setEnabled(this.recoverIconId, true, true);
iconMgr.setPosition(this.recoverIconId, flagIconOffset);
vfxManager.setPosition(this.smokeVFXId, this.currentPosition, ZERO_VEC);
vfxManager.setColor(this.smokeVFXId, GetTeamDroppedColor(this.team));
let friendlyVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
if(friendlyVO){
mod.PlayVO(friendlyVO, mod.VoiceOverEvents2D.ObjectiveContested, mod.VoiceOverFlags.Alpha, this.team);
}
this.StartAutoReturn(FLAG_AUTO_RETURN_TIME, this.numFlagTimesPickedUp).then( () => {console.log(`Flag ${this.teamId} auto-returning to base`)});
this.StartPickupDelay().then(() => {
vfxManager.setEnabled(this.smokeVFXId, true);
vfxManager.setPosition(this.sparksVFXId, this.currentPosition, ZERO_VEC);
vfxManager.setEnabled(this.sparksVFXId, true);
this.UpdateFlagInteractionPoint();
console.log("Flag pickup delay complete");
});
this.events.emit('flagDropped', {
flag: this,
position: this.currentPosition,
previousCarrier: previousCarrier
});
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
const iconMgr = worldIconManager;
iconMgr.setIcon(this.recoverIconId, mod.WorldIconImages.Alert);
iconMgr.setText(this.recoverIconId, mod.Message(mod.stringkeys.locked_flag_label));
for(let [teamId, iconId] of this.carriedIconIds){
iconMgr.setIcon(iconId, mod.WorldIconImages.Alert);
iconMgr.setText(iconId, mod.Message(mod.stringkeys.locked_flag_label));
}
if(this.pickupChargingVFX){
mod.MoveVFX(this.pickupChargingVFX, mod.Add(this.currentPosition, vfxHeightOffset), ZERO_VEC);
mod.EnableVFX(this.pickupChargingVFX, true);
}
if(this.pickupTimerStartSFX && this.pickupTimerRiseSFX && this.lastCarrier){
mod.PlaySound(this.pickupTimerStartSFX, 1);
await mod.Wait(0.1);
mod.PlaySound(this.pickupTimerRiseSFX, 1);
}
await mod.Wait(FLAG_PICKUP_DELAY);
if(this.pickupTimerStopSFX)
mod.PlaySound(this.pickupTimerStopSFX, 1);
if(this.pickupChargingVFX && this.pickupAvailableVFX){
mod.EnableVFX(this.pickupChargingVFX, false);
mod.MoveVFX(this.pickupAvailableVFX, mod.Add(this.currentPosition, vfxHeightOffset), ZERO_VEC);
mod.EnableVFX(this.pickupAvailableVFX, true);
}
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
ReturnFlag(): void {
if(DEBUG_MODE)
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.team_flag_returned));
this.PlayFlagReturnedSFX();
this.events.emit('flagReturned', {
flag: this,
wasAutoReturned: false
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
if(this.pickupAvailableVFX){
mod.EnableVFX(this.pickupAvailableVFX, false);
}
this.SpawnFlagAtHome();
this.StopFlagAlarm();
if (DEBUG_MODE) {
console.log(`Team ${this.teamId} flag returned`);
}
}
CheckAutoReturn(): void {
if (!this.isDropped) return;
const currentTime = GetCurrentTime();
if (currentTime >= this.autoReturnTime) {
if (DEBUG_MODE) {
console.log(`Flag ${this.team} auto-returning to base`);
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
this.events.emit('flagReturned', {
flag: this,
wasAutoReturned: true
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
let currentSoldierPosition = mod.GetSoldierState(
this.carrierPlayer,
mod.SoldierStateVector.GetPosition);
let currentRotation = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetFacingDirection);
let currentVelocity = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetLinearVelocity);
let soldierInAir = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsInAir);
let soldierParachuting = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsParachuting);
let soldierInVehicle = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsInVehicle);
let jsPlayer = JSPlayer.get(this.carrierPlayer);
if(jsPlayer){
jsPlayer.velocity = currentVelocity
}
if(FLAG_FOLLOW_MODE){
this.FollowPlayer(currentSoldierPosition, soldierParachuting);
} else {
this.currentPosition = currentSoldierPosition;
}
vfxManager.setPosition(this.smokeVFXId, this.currentPosition, currentRotation);
if(this.hoverVFX){
if(soldierParachuting){
mod.EnableVFX(this.hoverVFX, true);
mod.MoveVFX(this.hoverVFX, this.currentPosition, Math2.Vec3.FromVector(mod.ForwardVector()).DirectionToEuler().ToVector());
} else {
mod.EnableVFX(this.hoverVFX, false);
}
}
this.UpdateCarrierIcon();
this.CheckCarrierDroppedFlag(this.carrierPlayer);
}
FollowPlayer(currentSoldierPosition: mod.Vector, isParachuting?: boolean) {
let distanceToPlayer = Math2.Vec3.FromVector(currentSoldierPosition).Subtract(Math2.Vec3.FromVector(this.currentPosition)).Length();
let currentFlagPos = Math2.Vec3.FromVector(this.currentPosition);
let currentSoldierPos = Math2.Vec3.FromVector(currentSoldierPosition);
let soldierToFlagDir = currentSoldierPos.Subtract(currentFlagPos);
let soldierToFlagDirScaled = soldierToFlagDir.MultiplyScalar(0.85);
let flagPositionScaled = currentFlagPos.Add(soldierToFlagDirScaled);
let soldierParachuting = isParachuting ?? false;
this.followPoints.push(flagPositionScaled.ToVector());
if (this.followPoints.length > FLAG_FOLLOW_SAMPLES) {
this.followPoints.shift();
}
if (this.followPoints.length >= FLAG_FOLLOW_SAMPLES) {
let nextBufferPosition = this.followPoints.shift() ?? this.currentPosition;
let distanceNextPosToPlayer = Math2.Vec3.FromVector(currentSoldierPosition).Subtract(Math2.Vec3.FromVector(nextBufferPosition)).Length();
let minDistanceToMove = FLAG_FOLLOW_DISTANCE * 0.7;
if (distanceNextPosToPlayer > minDistanceToMove) {
let targetPos = Math2.Vec3.FromVector(nextBufferPosition);
let currentSmoothedPos = Math2.Vec3.FromVector(this.smoothedPosition);
let smoothedPos = targetPos.MultiplyScalar(FLAG_FOLLOW_POSITION_SMOOTHING)
.Add(currentSmoothedPos.MultiplyScalar(1 - FLAG_FOLLOW_POSITION_SMOOTHING));
this.smoothedPosition = smoothedPos.ToVector();
this.currentPosition = this.smoothedPosition;
let nextPosition = this.followPoints.length > 1 ? this.followPoints[0] : this.currentPosition;
let direction = Math2.Vec3.FromVector(nextPosition).Subtract(Math2.Vec3.FromVector(this.currentPosition)).MultiplyScalar(-1).Normalize();
direction = soldierParachuting ? direction.Multiply(new Math2.Vec3(1,0,1)).Normalize() : direction;
let targetRotation = direction.Length() > 0.01 ? direction.DirectionToEuler() : new Math2.Vec3(0, 0, 0);
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
let playerToFlagRot = smoothedPos.Subtract(currentSoldierPos).DirectionToEuler();
mod.MoveVFX(this.tetherPlayerVFX, currentSoldierPosition, playerToFlagRot.ToVector());
}
}
}
}
UpdateCarrierIcon(){
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
mod.AddEquipment(player, mod.Gadgets.Melee_Combat_Knife);
mod.ForceSwitchInventory(player, mod.InventorySlots.PrimaryWeapon);
if (DEBUG_MODE) {
console.log(`${mod.GetObjId(player)} Carrier weapons restored`);
}
}
IsPlayerOnThisTeam(player: mod.Player): boolean {
return mod.GetObjId(mod.GetTeam(player)) === this.teamId;
}
CanBePickedUpBy(playerTeamId: number): boolean {
if (this.owningTeamId === playerTeamId) return false;
if (this.allowedCapturingTeams.length > 0) {
return this.allowedCapturingTeams.includes(playerTeamId);
}
return true;
}
GetFlagColor(): mod.Vector {
if (this.customColor) return this.customColor;
return GetTeamColorById(this.owningTeamId);
}
async PlayFlagAlarm(): Promise<void>{
this.alarmSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Alarm, this.currentPosition, ZERO_VEC);
if(this.alarmSFX){
mod.PlaySound(this.alarmSFX, 1, this.currentPosition, 100);
}
await mod.Wait(FLAG_SFX_DURATION);
this.StopFlagAlarm();
}
PlayFlagTakenVO(){
let vo_flag = DEFAULT_TEAM_VO_FLAGS.get(this.teamId);
let flagOwningTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
if(flagOwningTeamVO && vo_flag){
mod.PlayVO(flagOwningTeamVO, mod.VoiceOverEvents2D.ObjectiveLost, vo_flag, this.team);
}
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
let pickupSfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_ObjetiveUnlockReveal_OneShot2D, this.homePosition, ZERO_VEC);
mod.PlaySound(pickupSfx, 1);
let flagOwningTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
if(flagOwningTeamVO && vo_flag){
mod.PlayVO(flagOwningTeamVO, mod.VoiceOverEvents2D.ObjectiveNeutralised, vo_flag, this.team);
}
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
}
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
else if (playerTeamId === flag.teamId){
if(flag.isDropped){
if(DEBUG_MODE)
mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.team_flag_returned, GetTeamName(flag.team)));
flag.PlayFlagReturnedSFX();
flag.ReturnFlag();
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
for (const [flagId, flagData] of flags.entries()) {
if (flagData.carrierPlayer && mod.Equals(flagData.carrierPlayer, player)) {
return true;
}
}
return false;
}
function WasCarryingAnyFlag(player: mod.Player): boolean {
for (const [flagId, flagData] of flags.entries()) {
if (flagData.carrierPlayer && mod.Equals(flagData.lastCarrier, player)) {
return true;
}
}
return false;
}
function GetOpposingTeamsForFlag(flagData: Flag): number[] {
if (flagData.allowedCapturingTeams.length > 0) {
return flagData.allowedCapturingTeams;
}
return GetOpposingTeams(flagData.owningTeamId);
}
class CaptureZone {
readonly team: mod.Team;
readonly teamId: number;
readonly areaTrigger: mod.AreaTrigger | undefined;
readonly captureZoneID?: number;
readonly captureZoneSpatialObjId?: number;
readonly position: mod.Vector;
readonly iconPosition: mod.Vector;
readonly baseIcons?: Map<number, mod.WorldIcon>;
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
this.iconPosition = mod.Add(this.position, mod.CreateVector(0.0, FLAG_ICON_HEIGHT_OFFSET, 0.0));
const iconMgr = worldIconManager;
this.baseIcons = new Map();
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
teamOwner: team
}
);
this.baseIcons.set(mod.GetObjId(team), teamIcon);
this.baseIconIds.set(mod.GetObjId(team), teamIconId);
let opposingTeams = GetOpposingTeams(mod.GetObjId(team));
if(opposingTeams.length && team){
for(let opposingTeam of opposingTeams){
const opposingIconId = `capturezone_${this.teamId}_team${opposingTeam}`;
let opposingIcon = iconMgr.createIcon(
opposingIconId,
this.iconPosition,
{
icon: mod.WorldIconImages.Triangle,
iconEnabled: true,
textEnabled: true,
color: GetTeamColorById(this.teamId),
teamOwner: mod.GetTeam(opposingTeam)
}
);
this.baseIcons.set(opposingTeam, opposingIcon);
this.baseIconIds.set(opposingTeam, opposingIconId);
}
}
this.UpdateIcons();
} else {
console.log(`Can't create WorldIcon for ${this.teamId} capture zone. Spatial object ${captureZoneSpatialObj} returned for id ${this.captureZoneSpatialObjId}}`);
}
} else {
console.log(`Can't create WorldIcon for ${this.teamId} capture zone. Spatial object ID was ${this.captureZoneSpatialObjId}`);
}
}
UpdateIcons(){
const iconMgr = worldIconManager;
for(let [targetTeamId, iconId] of this.baseIconIds.entries()){
if(targetTeamId == this.teamId){
} else {
}
iconMgr.setText(iconId, mod.Message(mod.stringkeys.capture_zone_label, GetTeamName(this.team)));
iconMgr.setIcon(iconId, mod.WorldIconImages.Triangle);
iconMgr.setColor(iconId, GetTeamColorById(this.teamId));
iconMgr.setPosition(iconId, this.iconPosition);
iconMgr.setEnabled(iconId, true, true);
}
}
HandleCaptureZoneEntry(player: mod.Player): void
{
let jsPlayer = JSPlayer.get(player);
let playerTeamId = mod.GetObjId(mod.GetTeam(player));
GetCarriedFlags(player).forEach((flag:Flag) => {
if (!flag) {
if (DEBUG_MODE) {
console.log(`Could not find a held flag for the provided player ${mod.GetObjId(player)}`);
}
return;
}
if (flag.owningTeamId === playerTeamId) {
if (DEBUG_MODE) {
console.log(`Player ${mod.GetObjId(player)} entered their teams capture zone but doesn't have the enemy flag`);
}
return;
}
if (this.teamId !== playerTeamId) {
if (DEBUG_MODE) {
console.log(`Players team ${playerTeamId} but entered wrong capture zone ${this.teamId}`);
}
return;
}
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
interface WorldIconState {
id: string;
position: mod.Vector;
text?: mod.Message;
textEnabled: boolean;
icon?: mod.WorldIconImages;
iconEnabled: boolean;
color?: mod.Vector;
teamOwner?: mod.Team;
playerOwner?: mod.Player;
}
class WorldIconManager {
private static instance: WorldIconManager;
private icons: Map<string, mod.WorldIcon> = new Map();
private iconStates: Map<string, WorldIconState> = new Map();
private constructor() {
if (DEBUG_MODE) {
console.log('WorldIconManager: Initialized');
}
}
static getInstance(): WorldIconManager {
if (!WorldIconManager.instance) {
WorldIconManager.instance = new WorldIconManager();
}
return WorldIconManager.instance;
}
createIcon(
id: string,
position: mod.Vector,
options?: {
text?: mod.Message;
textEnabled?: boolean;
icon?: mod.WorldIconImages;
iconEnabled?: boolean;
color?: mod.Vector;
teamOwner?: mod.Team;
playerOwner?: mod.Player;
}
): mod.WorldIcon {
if (this.icons.has(id)) {
this.deleteIcon(id);
}
const icon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, position, ZERO_VEC) as mod.WorldIcon;
if (options?.teamOwner !== undefined) {
mod.SetWorldIconOwner(icon, options.teamOwner);
} else if (options?.playerOwner !== undefined) {
mod.SetWorldIconOwner(icon, options.playerOwner);
}
if (options?.text !== undefined) {
mod.SetWorldIconText(icon, options.text);
}
const textEnabled = options?.textEnabled ?? false;
mod.EnableWorldIconText(icon, textEnabled);
if (options?.icon !== undefined) {
mod.SetWorldIconImage(icon, options.icon);
}
const iconEnabled = options?.iconEnabled ?? false;
mod.EnableWorldIconImage(icon, iconEnabled);
if (options?.color !== undefined) {
mod.SetWorldIconColor(icon, options.color);
}
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
getIcon(id: string): mod.WorldIcon | undefined {
return this.icons.get(id);
}
setPosition(id: string, position: mod.Vector): void {
const icon = this.icons.get(id);
const state = this.iconStates.get(id);
if (icon && state) {
mod.SetWorldIconPosition(icon, position);
state.position = position;
}
}
setText(id: string, text: mod.Message): void {
const icon = this.icons.get(id);
const state = this.iconStates.get(id);
if (icon && state) {
mod.SetWorldIconText(icon, text);
state.text = text;
}
}
setIcon(id: string, iconImage: mod.WorldIconImages): void {
const icon = this.icons.get(id);
const state = this.iconStates.get(id);
if (icon && state) {
mod.SetWorldIconImage(icon, iconImage);
state.icon = iconImage;
}
}
setColor(id: string, color: mod.Vector): void {
const icon = this.icons.get(id);
const state = this.iconStates.get(id);
if (icon && state) {
mod.SetWorldIconColor(icon, color);
state.color = color;
}
}
setTextEnabled(id: string, enabled: boolean): void {
const icon = this.icons.get(id);
const state = this.iconStates.get(id);
if (icon && state) {
mod.EnableWorldIconText(icon, enabled);
state.textEnabled = enabled;
}
}
setIconEnabled(id: string, enabled: boolean): void {
const icon = this.icons.get(id);
const state = this.iconStates.get(id);
if (icon && state) {
mod.EnableWorldIconImage(icon, enabled);
state.iconEnabled = enabled;
}
}
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
setTeamOwner(id: string, team: mod.Team): void {
const icon = this.icons.get(id);
const state = this.iconStates.get(id);
if (icon && state) {
mod.SetWorldIconOwner(icon, team);
state.teamOwner = team;
state.playerOwner = undefined;
}
}
setPlayerOwner(id: string, player: mod.Player): void {
const icon = this.icons.get(id);
const state = this.iconStates.get(id);
if (icon && state) {
mod.SetWorldIconOwner(icon, player);
state.playerOwner = player;
state.teamOwner = undefined;
}
}
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
private refreshIcon(id: string): void {
const state = this.iconStates.get(id);
if (!state) return;
const oldIcon = this.icons.get(id);
if (oldIcon) {
mod.UnspawnObject(oldIcon);
}
const newIcon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, state.position, ZERO_VEC) as mod.WorldIcon;
if (state.teamOwner !== undefined) {
mod.SetWorldIconOwner(newIcon, state.teamOwner);
} else if (state.playerOwner !== undefined) {
mod.SetWorldIconOwner(newIcon, state.playerOwner);
}
if (state.text !== undefined) {
mod.SetWorldIconText(newIcon, state.text);
}
mod.EnableWorldIconText(newIcon, state.textEnabled);
if (state.icon !== undefined) {
mod.SetWorldIconImage(newIcon, state.icon);
}
mod.EnableWorldIconImage(newIcon, state.iconEnabled);
if (state.color !== undefined) {
mod.SetWorldIconColor(newIcon, state.color);
}
this.icons.set(id, newIcon);
if (DEBUG_MODE) {
console.log(`WorldIconManager: Refreshed icon '${id}'`);
}
}
refreshAllIcons(): void {
if (DEBUG_MODE) {
console.log(`WorldIconManager: Refreshing ${this.iconStates.size} icons`);
}
for (const id of this.iconStates.keys()) {
this.refreshIcon(id);
}
}
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
getIconCount(): number {
return this.icons.size;
}
hasIcon(id: string): boolean {
return this.icons.has(id);
}
}
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
interface VFXState {
id: string;
vfxType: RuntimeSpawnType;
position: mod.Vector;
rotation: mod.Vector;
color?: mod.Vector;
enabled: boolean;
scale?: number;
}
class VFXManager {
private static instance: VFXManager;
private vfxObjects: Map<string, mod.VFX> = new Map();
private vfxStates: Map<string, VFXState> = new Map();
private constructor() {
if (DEBUG_MODE) {
console.log('VFXManager: Initialized');
}
}
static getInstance(): VFXManager {
if (!VFXManager.instance) {
VFXManager.instance = new VFXManager();
}
return VFXManager.instance;
}
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
if (this.vfxObjects.has(id)) {
this.deleteVFX(id);
}
const vfx = mod.SpawnObject(vfxType, position, rotation) as mod.VFX;
if (options?.color !== undefined) {
mod.SetVFXColor(vfx, options.color);
}
if (options?.scale !== undefined) {
mod.SetVFXScale(vfx, options.scale);
}
const enabled = options?.enabled ?? true;
mod.EnableVFX(vfx, enabled);
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
getVFX(id: string): mod.VFX | undefined {
return this.vfxObjects.get(id);
}
setPosition(id: string, position: mod.Vector, rotation: mod.Vector): void {
const vfx = this.vfxObjects.get(id);
const state = this.vfxStates.get(id);
if (vfx && state) {
mod.MoveVFX(vfx, position, rotation);
state.position = position;
state.rotation = rotation;
}
}
setColor(id: string, color: mod.Vector): void {
const vfx = this.vfxObjects.get(id);
const state = this.vfxStates.get(id);
if (vfx && state) {
mod.SetVFXColor(vfx, color);
state.color = color;
}
}
setEnabled(id: string, enabled: boolean): void {
const vfx = this.vfxObjects.get(id);
const state = this.vfxStates.get(id);
if (vfx && state) {
mod.EnableVFX(vfx, enabled);
state.enabled = enabled;
}
}
setScale(id: string, scale: number): void {
const vfx = this.vfxObjects.get(id);
const state = this.vfxStates.get(id);
if (vfx && state) {
mod.SetVFXScale(vfx, scale);
state.scale = scale;
}
}
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
private refreshVFX(id: string): void {
const vfx = this.vfxObjects.get(id);
const state = this.vfxStates.get(id);
if (!vfx || !state) return;
mod.EnableVFX(vfx, false);
mod.EnableVFX(vfx, state.enabled);
if (DEBUG_MODE) {
console.log(`VFXManager: Refreshed VFX '${id}' (toggled ${state.enabled ? 'on' : 'off'})`);
}
}
refreshAllVFX(): void {
if (DEBUG_MODE) {
console.log(`VFXManager: Refreshing ${this.vfxStates.size} VFX effects`);
}
for (const id of this.vfxStates.keys()) {
this.refreshVFX(id);
}
}
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
getVFXCount(): number {
return this.vfxObjects.size;
}
hasVFX(id: string): boolean {
return this.vfxObjects.has(id);
}
}
interface BaseScoreboardHUD {
readonly player: mod.Player;
readonly playerId: number;
readonly rootWidget: mod.UIWidget | undefined;
create(): void;
refresh(): void;
close(): void;
isOpen(): boolean;
}
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
protected columnWidget!: mod.UIWidget;
protected columnWidgetOutline!: mod.UIWidget;
protected textWidget!: mod.UIWidget;
protected progressBarContainer: mod.UIWidget | undefined;
protected progressValue: number;
protected progressDirection: 'left' | 'right';
protected showProgressBar: boolean;
protected leftBracketSide: mod.UIWidget | undefined;
protected leftBracketTop: mod.UIWidget | undefined;
protected leftBracketBottom: mod.UIWidget | undefined;
protected rightBracketSide: mod.UIWidget | undefined;
protected rightBracketTop: mod.UIWidget | undefined;
protected rightBracketBottom: mod.UIWidget | undefined;
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
protected createWidgets(): void {
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
this.createTextWidget();
if (this.showProgressBar) {
this.createProgressBar();
}
this.createBrackets();
}
protected createTextWidget(): void {
this.textWidget = modlib.ParseUI({
type: "Text",
parent: this.columnWidget,
position: [0, 0],
size: [this.size[0], 25],
anchor: mod.UIAnchor.Center,
textAnchor: mod.UIAnchor.Center,
textSize: this.textSize,
textLabel: "",
textColor: this.textColor,
bgAlpha: 0,
})!;
}
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
public setProgressValue(value: number): void {
this.progressValue = Math.max(0, Math.min(1, value));
if (this.progressBarContainer) {
const progressWidth = this.size[0] * this.progressValue;
mod.SetUIWidgetSize(this.progressBarContainer, mod.CreateVector(progressWidth, this.size[1], 0));
}
}
public setProgressDirection(direction: 'left' | 'right'): void {
this.progressDirection = direction;
if (this.progressBarContainer) {
const anchor = direction === 'left' ? mod.UIAnchor.CenterLeft : mod.UIAnchor.CenterRight;
mod.SetUIWidgetAnchor(this.progressBarContainer, anchor);
}
}
public getProgressValue(): number {
return this.progressValue;
}
protected createBrackets(): void {
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
this.showBrackets(false);
}
protected updateText(message: mod.Message): void {
mod.SetUITextLabel(this.textWidget, message);
}
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
public destroy(): void {
if (this.leftBracketTop) mod.DeleteUIWidget(this.leftBracketTop);
if (this.leftBracketSide) mod.DeleteUIWidget(this.leftBracketSide);
if (this.leftBracketBottom) mod.DeleteUIWidget(this.leftBracketBottom);
if (this.rightBracketTop) mod.DeleteUIWidget(this.rightBracketTop);
if (this.rightBracketSide) mod.DeleteUIWidget(this.rightBracketSide);
if (this.rightBracketBottom) mod.DeleteUIWidget(this.rightBracketBottom);
if (this.progressBarContainer) mod.DeleteUIWidget(this.progressBarContainer);
if (this.textWidget) mod.DeleteUIWidget(this.textWidget);
if (this.columnWidgetOutline) mod.DeleteUIWidget(this.columnWidgetOutline);
if (this.columnWidget) mod.DeleteUIWidget(this.columnWidget);
}
abstract refresh(): void;
}
interface ScoreTickerParams {
team: mod.Team;
position: number[];
size: number[];
parent: mod.UIWidget;
textSize?: number;
bracketTopBottomLength?: number;
bracketThickness?: number;
}
class ScoreTicker extends TickerWidget {
readonly team: mod.Team;
readonly teamId: number;
private currentScore: number = -1;
private isLeading: boolean = false;
constructor(params: ScoreTickerParams) {
const teamId = mod.GetObjId(params.team);
const teamColor = GetTeamColorById(teamId);
const textColor = VectorClampToRange(
GetTeamColorLight(params.team),
0,
1
);
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
this.refresh();
}
public updateScore(): void {
const score = teamScores.get(this.teamId) ?? 0;
if (this.currentScore !== score) {
this.currentScore = score;
this.updateText(mod.Message(score));
let leadingTeams = GetLeadingTeamIDs();
console.log(`Leading teams: ${leadingTeams.join(", ")}`);
if(leadingTeams.length === 1 && leadingTeams.includes(this.teamId)){
this.setLeading(true);
} else {
this.setLeading(true);
}
}
}
public setLeading(isLeading: boolean): void {
console.log(`Score ticker leading: ${isLeading}`);
this.isLeading = isLeading;
this.showBrackets(isLeading);
}
public getScore(): number {
return this.currentScore;
}
public getTeamId(): number {
return this.teamId;
}
public refresh(): void {
this.updateScore();
}
public destroy(): void {
super.destroy();
}
}
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
public updateTime(): void {
const remainingTime = mod.GetMatchTimeRemaining();
const timeSeconds = Math.floor(remainingTime);
if (this.currentTimeSeconds !== timeSeconds) {
this.currentTimeSeconds = timeSeconds % 60;
this.currentTimeMinutes = Math.floor(timeSeconds / 60);
const secondsTensDigit = Math.floor(this.currentTimeSeconds / 10);
const secondsOnesDigit = this.currentTimeSeconds % 10;
mod.SetUITextLabel(this.minutesText, mod.Message(mod.stringkeys.score_timer_minutes, this.currentTimeMinutes));
mod.SetUITextLabel(this.secondsText, mod.Message(mod.stringkeys.score_timer_seconds, secondsTensDigit, secondsOnesDigit));
}
}
public refresh(): void {
this.updateTime();
}
public destroy(): void {
if (this.secondsText) mod.DeleteUIWidget(this.secondsText);
if (this.minutesText) mod.DeleteUIWidget(this.minutesText);
if (this.seperatorText) mod.DeleteUIWidget(this.seperatorText);
super.destroy();
}
}
interface FlagBarParams {
position: number[];
size: number[];
parent: mod.UIWidget;
team1: mod.Team;
team2: mod.Team;
team1CaptureZonePosition: mod.Vector;
team2CaptureZonePosition: mod.Vector;
barHeight?: number;
barSeperatorPadding?: number;
flagIconSize?: number[];
}
interface FlagBarState {
targetProgress: number;
currentProgress: number;
velocity: number;
}
class FlagBar {
private readonly params: FlagBarParams;
private rootContainer: mod.UIWidget;
private team1Bar: TickerWidget;
private team2Bar: TickerWidget;
private team1FlagIcon: FlagIcon;
private team2FlagIcon: FlagIcon;
private team1FlagState: FlagBarState;
private team2FlagState: FlagBarState;
private readonly team1: mod.Team;
private readonly team2: mod.Team;
private readonly team1Id: number;
private readonly team2Id: number;
private readonly barWidth: number;
private readonly barHeight: number;
private readonly halfBarWidth: number;
private readonly flagIconSize: number[];
private readonly barSeperatorSize: number;
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
this.rootContainer = this.createRootContainer();
this.team1Bar = this.createTeamBar(this.team1, true);
this.team2Bar = this.createTeamBar(this.team2, false);
this.team1FlagIcon = this.createFlagIcon(this.team1, this.team1Id);
this.team2FlagIcon = this.createFlagIcon(this.team2, this.team2Id);
}
private createRootContainer(): mod.UIWidget {
return modlib.ParseUI({
type: "Container",
parent: this.params.parent,
position: this.params.position,
size: [this.barWidth, this.barHeight],
anchor: mod.UIAnchor.TopCenter,
bgAlpha: 0
})!;
}
private createTeamBar(team: mod.Team, isLeftSide: boolean): TickerWidget {
const teamId = mod.GetObjId(team);
const teamColor = GetTeamColorById(teamId);
const xPos = isLeftSide ? (-this.halfBarWidth / 2) - this.barSeperatorSize : (this.halfBarWidth / 2) + this.barSeperatorSize;
class FlagBarTicker extends TickerWidget {
refresh(): void {
}
}
const textColor = VectorClampToRange(
GetTeamColorLight(team),
0,
1
);
const midColor = VectorClampToRange(
Math2.Vec3.FromVector(teamColor).Add(new Math2.Vec3(0.15, 0.15, 0.15)).ToVector(),
0,
1
);
return new FlagBarTicker({
position: [xPos, 0],
size: [this.halfBarWidth, this.barHeight],
parent: this.rootContainer,
textSize: 0,
textColor: midColor,
bgColor: teamColor,
bgAlpha: 0.5,
showProgressBar: true,
progressValue: 1.0,
progressDirection: isLeftSide ? 'right' : 'left'
});
}
private createFlagIcon(team: mod.Team, teamId: number): FlagIcon {
const teamColor = GetTeamColorById(teamId);
const textColor = VectorClampToRange(
GetTeamColorLight(team),
0,
1
);
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
public update(flags: Map<number, Flag>, deltaTime: number = 1.0): void {
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
private updateFlagState(
flag: Flag,
flagState: FlagBarState,
flagIcon: FlagIcon,
opposingBar: TickerWidget,
captureZonePosition: mod.Vector,
isLeftTeam: boolean,
deltaTime: number
): void {
flagState.targetProgress = this.calculateFlagProgress(flag, captureZonePosition);
if (DEBUG_MODE) {
}
this.smoothDampProgress(flagState, deltaTime);
if (DEBUG_MODE) {
}
this.updateFlagIconPosition(flagIcon, flagState.currentProgress, isLeftTeam);
if (flag.isDropped && !flagIcon.isPulsing) {
flagIcon.StartThrob(1, 0.1, 0.8);
} else if(!flag.isDropped && flagIcon.isPulsing) {
flagIcon.StopThrob();
flagIcon.SetFillAlpha(1);
}
const barProgress = 1.0 - flagState.currentProgress * 2;
opposingBar.setProgressValue(barProgress);
if (DEBUG_MODE) {
}
}
private calculateFlagProgress(flag: Flag, captureZonePosition: mod.Vector): number {
if (flag.isAtHome) {
return 0.0;
}
const homePos = flag.homePosition;
const currentPos = flag.currentPosition;
if (DEBUG_MODE) {
}
const homeToCaptureVec = Math2.Vec3.FromVector(captureZonePosition)
.Subtract(Math2.Vec3.FromVector(homePos));
const homeToCurrentVec = Math2.Vec3.FromVector(currentPos)
.Subtract(Math2.Vec3.FromVector(homePos));
const totalDistanceSquared = (homeToCaptureVec.x * homeToCaptureVec.x) +
(homeToCaptureVec.y * homeToCaptureVec.y) +
(homeToCaptureVec.z * homeToCaptureVec.z);
const totalDistance = Math.sqrt(totalDistanceSquared);
if (totalDistance < 0.01) {
return 0.0;
}
const dotProduct = (homeToCurrentVec.x * homeToCaptureVec.x) +
(homeToCurrentVec.y * homeToCaptureVec.y) +
(homeToCurrentVec.z * homeToCaptureVec.z);
const projectedDistance = dotProduct / totalDistance;
if (DEBUG_MODE) {
}
const progress = Math.max(0.0, Math.min(1.0, projectedDistance / totalDistance));
if (DEBUG_MODE) {
}
return progress;
}
private smoothDampProgress(flagState: FlagBarState, deltaTime: number): void {
const smoothTime = 2.0;
const omega = 2.0 / smoothTime;
const x = omega * deltaTime;
const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
const change = flagState.currentProgress - flagState.targetProgress;
const temp = (flagState.velocity + omega * change) * deltaTime;
flagState.velocity = (flagState.velocity - omega * temp) * exp;
flagState.currentProgress = flagState.targetProgress + (change + temp) * exp;
flagState.currentProgress = Math.max(0.0, Math.min(1.0, flagState.currentProgress));
}
private updateFlagIconPosition(
flagIcon: FlagIcon,
progress: number,
isLeftTeam: boolean
): void {
let xPos: number;
if (isLeftTeam) {
xPos = -this.halfBarWidth + (this.flagIconSize[0] * 0.5) - this.barSeperatorSize + (progress * this.barWidth);
} else {
xPos = this.halfBarWidth - (this.flagIconSize[0] * 0.5) + this.barSeperatorSize - (progress * this.barWidth);
}
const yPos = 3;
if (DEBUG_MODE) {
}
flagIcon.SetPosition(mod.CreateVector(xPos, yPos, 0));
}
public destroy(): void {
this.team1FlagIcon.Destroy();
this.team2FlagIcon.Destroy();
mod.DeleteUIWidget(this.rootContainer);
}
}
interface FlagIconParams {
name: string;
position: mod.Vector;
size: mod.Vector;
anchor: mod.UIAnchor;
parent: mod.UIWidget;
visible?: boolean;
fillColor?: mod.Vector;
fillAlpha?: number;
outlineColor?: mod.Vector;
outlineAlpha?: number;
outlineThickness?: number;
showFill?: boolean;
showOutline?: boolean;
teamId?: mod.Team;
playerId?: mod.Player;
bgFill?: mod.UIBgFill;
flagPoleGap?: number;
}
class FlagIcon {
private rootContainer: mod.UIWidget;
private fillContainers: mod.UIWidget[] = [];
private outlineContainers: mod.UIWidget[] = [];
private readonly params: FlagIconParams;
isPulsing: boolean;
private readonly POLE_WIDTH_RATIO = 0.15;
private readonly POLE_HEIGHT_RATIO = 1.0;
private readonly FLAG_WIDTH_RATIO = 0.85;
private readonly FLAG_HEIGHT_RATIO = 0.55;
constructor(params: FlagIconParams) {
this.params = params;
this.params.showFill = params.showFill ?? true;
this.params.showOutline = params.showOutline ?? false;
this.params.fillColor = VectorClampToRange(params.fillColor ?? mod.CreateVector(1, 1, 1), 0, 1);
this.params.fillAlpha = params.fillAlpha ?? 1.0;
this.params.outlineColor = VectorClampToRange(params.outlineColor ?? mod.CreateVector(1, 1, 1), 0, 1);
this.params.outlineAlpha = params.outlineAlpha ?? 1.0;
this.params.flagPoleGap = params.flagPoleGap ?? 2.0;
this.isPulsing = false;
this.rootContainer = this.createRootContainer();
this.createFilledFlag();
this.createOutlineFlag();
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
bgAlpha: 0,
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
const poleX = 0;
const poleY = 0;
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
this.fillContainers = [pole, flag];
}
private createOutlineFlag(): void {
const totalWidth = mod.XComponentOf(this.params.size);
const totalHeight = mod.YComponentOf(this.params.size);
const thickness = this.params.outlineThickness ?? 2;
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
padding: 0
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
this.outlineContainers = [flag, pole];
}
IsVisible(): boolean {
return mod.GetUIWidgetVisible(this.rootContainer);
}
SetFillVisible(visible: boolean): void {
this.params.showFill = visible;
this.fillContainers.forEach(container => {
mod.SetUIWidgetVisible(container, visible);
});
}
SetOutlineVisible(visible: boolean): void {
this.params.showOutline = visible;
this.outlineContainers.forEach(container => {
mod.SetUIWidgetVisible(container, visible);
});
}
IsFillVisible(): boolean {
return this.params.showFill ?? false;
}
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
SetFillColor(color: mod.Vector, alpha?: number): void {
const newAlpha = alpha ?? this.params.fillAlpha ?? 1.0;
let clampedColor = VectorClampToRange(color, 0, 1);
this.fillContainers.forEach(container => {
mod.SetUIWidgetBgColor(container, clampedColor);
mod.SetUIWidgetBgAlpha(container, newAlpha);
});
this.params.fillColor = clampedColor;
this.params.fillAlpha = newAlpha;
}
SetFillAlpha(alpha: number): void {
if(AreFloatsEqual(alpha, this.params.fillAlpha ?? 1.0))
return;
this.params.fillAlpha = alpha;
this.fillContainers.forEach(container => {
mod.SetUIWidgetBgAlpha(container, alpha);
});
}
SetOutlineColor(color: mod.Vector, alpha?: number): void {
const newAlpha = alpha ?? this.params.outlineAlpha ?? 1.0;
let clampedColor = VectorClampToRange(color, 0, 1);
this.outlineContainers.forEach(container => {
mod.SetUIWidgetBgColor(container, clampedColor);
mod.SetUIWidgetBgAlpha(container, newAlpha);
});
this.params.outlineColor = clampedColor;
this.params.outlineAlpha = newAlpha;
}
SetOutlineAlpha(alpha: number): void {
if(AreFloatsEqual(alpha, this.params.outlineAlpha ?? 1.0))
return;
this.params.outlineAlpha = alpha;
this.outlineContainers.forEach(container => {
mod.SetUIWidgetBgAlpha(container, alpha);
});
}
SetColor(color: mod.Vector, alpha?: number): void {
this.SetFillColor(color, alpha);
this.SetOutlineColor(color, alpha);
}
SetPosition(position: mod.Vector): void {
mod.SetUIWidgetPosition(this.rootContainer, position);
this.params.position = position;
}
SetParent(parent: mod.UIWidget): void {
mod.SetUIWidgetParent(this.rootContainer, parent);
this.params.parent = parent;
}
SetVisible(visible: boolean): void {
mod.SetUIWidgetVisible(this.rootContainer, visible);
}
Destroy(): void {
this.fillContainers.forEach(container => {
mod.DeleteUIWidget(container);
});
this.outlineContainers.forEach(container => {
mod.DeleteUIWidget(container);
});
mod.DeleteUIWidget(this.rootContainer);
this.fillContainers = [];
this.outlineContainers = [];
}
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
constructor(team:mod.Team, tickerParams: TickerWidgetParams) {
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
this.SetTeamOrder(this.lastOrder);
this.bindFlagEvents();
}
private bindFlagEvents(): void {
for (let [flagId, flag] of flags) {
const unsubTaken = flag.events.on('flagTaken', (data) => {
this.handleFlagTaken(data.flag, data.player, data.isAtHome);
});
this.eventUnsubscribers.push(unsubTaken);
const unsubDropped = flag.events.on('flagDropped', (data) => {
this.handleFlagDropped(data.flag, data.position, data.previousCarrier);
});
this.eventUnsubscribers.push(unsubDropped);
const unsubReturned = flag.events.on('flagReturned', (data) => {
this.handleFlagReturned(data.flag, data.wasAutoReturned);
});
this.eventUnsubscribers.push(unsubReturned);
const unsubCaptured = flag.events.on("flagCaptured", (data) => {
this.handleFlagCaptured(data.flag);
});
this.eventUnsubscribers.push(unsubCaptured);
}
}
private handleFlagTaken(flag: Flag, player: mod.Player, wasAtHome: boolean): void {
const playerTeamId = mod.GetObjId(mod.GetTeam(player));
if (flag.teamId === this.teamId) {
this.SetTeamOrder(TeamOrders.OurFlagTaken);
} else if (playerTeamId === this.teamId) {
this.SetTeamOrder(TeamOrders.EnemyFlagTaken);
}
}
private handleFlagDropped(flag: Flag, position: mod.Vector, previousCarrier: mod.Player | null): void {
if (flag.teamId === this.teamId) {
this.SetTeamOrder(TeamOrders.OurFlagDropped);
} else {
if (previousCarrier) {
const carrierTeamId = mod.GetObjId(mod.GetTeam(previousCarrier));
if (carrierTeamId === this.teamId) {
this.SetTeamOrder(TeamOrders.EnemyFlagDropped);
}
}
}
}
private handleFlagReturned(flag: Flag, wasAutoReturned: boolean): void {
if (flag.teamId === this.teamId) {
this.SetTeamOrder(TeamOrders.OurFlagReturned);
} else {
this.SetTeamOrder(TeamOrders.EnemyFlagReturned);
}
}
private handleFlagCaptured(flag: Flag): void {
if (flag.teamId === this.teamId) {
this.SetTeamOrder(TeamOrders.OurFlagCaptured);
} else {
this.SetTeamOrder(TeamOrders.EnemyFlagCaptured);
}
}
refresh(): void {
}
destroy(): void {
for (const unsubscribe of this.eventUnsubscribers) {
unsubscribe();
}
this.eventUnsubscribers = [];
super.destroy();
}
SetTeamOrder(teamOrder: TeamOrders): void {
this.updateText(this.TeamOrderToMessage(teamOrder));
}
TeamOrderToMessage(order:TeamOrders): mod.Message {
switch(order){
case TeamOrders.OurFlagTaken:
return mod.Message(mod.stringkeys.order_flag_taken, mod.stringkeys.order_friendly);
case TeamOrders.OurFlagDropped:
return mod.Message(mod.stringkeys.order_flag_dropped, mod.stringkeys.order_friendly);
case TeamOrders.OurFlagReturned:
return mod.Message(mod.stringkeys.order_flag_returned, mod.stringkeys.order_friendly);
case TeamOrders.OurFlagCaptured:
return mod.Message(mod.stringkeys.order_flag_captured_friendly);
case TeamOrders.EnemyFlagTaken:
return mod.Message(mod.stringkeys.order_flag_taken, mod.stringkeys.order_enemy);
case TeamOrders.EnemyFlagDropped:
return mod.Message(mod.stringkeys.order_flag_dropped, mod.stringkeys.order_enemy);
case TeamOrders.EnemyFlagReturned:
return mod.Message(mod.stringkeys.order_flag_returned, mod.stringkeys.order_enemy);
case TeamOrders.EnemyFlagCaptured:
return mod.Message(mod.stringkeys.order_flag_captured_enemy);
case TeamOrders.TeamIdentify:
return mod.Message(mod.stringkeys.order_team_identifier, GetTeamName(this.team));
}
return mod.Message(mod.stringkeys.order_team_identifier, GetTeamName(this.team));
}
}
function BuildFlagStatus(flag: Flag): mod.Message {
if (flag.isAtHome) return mod.Message(mod.stringkeys.scoreUI_flag_status_home);
if (flag.isBeingCarried) return mod.Message(mod.stringkeys.scoreUI_flag_status_carried);
if (flag.isDropped) return mod.Message(mod.stringkeys.scoreUI_flag_status_dropped);
return mod.Message(mod.stringkeys.scoreUI_flag_status_home);
}
class TeamColumnWidget {
readonly teamId: number;
readonly team: mod.Team;
readonly isPlayerTeam: boolean;
readonly scoreTicker: ScoreTicker;
readonly flagIcon: FlagIcon;
readonly verticalPadding:number = 8;
constructor(team: mod.Team, position: number[], size: number[], parent: mod.UIWidget, isPlayerTeam:boolean) {
this.team = team;
this.teamId = mod.GetObjId(team);
this.isPlayerTeam = isPlayerTeam;
this.scoreTicker = new ScoreTicker({
team: team,
position: position,
size: size,
parent: parent,
textSize: 28,
bracketTopBottomLength: 10,
bracketThickness: 3
});
let flagIconConfig: FlagIconParams = {
name: `FlagHomeIcon_Team${this.teamId}`,
parent: parent,
position: mod.CreateVector(position[0], position[1] + size[1] + this.verticalPadding, 0),
size: mod.CreateVector(28, 28, 0),
anchor: mod.UIAnchor.TopCenter,
fillColor: GetTeamColorById(this.teamId),
fillAlpha: 1,
outlineColor: GetTeamColorById(this.teamId),
outlineAlpha: 1,
showFill: true,
showOutline: true,
bgFill: mod.UIBgFill.Solid,
outlineThickness: 0
};
this.flagIcon = new FlagIcon(flagIconConfig);
}
update(): void {
this.scoreTicker.updateScore();
const flag = flags.get(this.teamId);
if(flag){
const flagStatus = BuildFlagStatus(flag);
if(flag.isAtHome){
this.flagIcon.SetVisible(true);
this.flagIcon.SetFillAlpha(1);
this.flagIcon.SetOutlineAlpha(1);
} else if(flag.isBeingCarried){
this.flagIcon.SetVisible(false);
} else if(flag.isDropped){
this.flagIcon.SetVisible(true);
this.flagIcon.SetFillAlpha(0.15);
this.flagIcon.SetOutlineAlpha(0.75);
}
}
}
setLeading(isLeading: boolean): void {
this.scoreTicker.setLeading(isLeading);
}
}
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
this.player = (null as any);
this.playerId = -1;
this.create();
}
create(): void {
if (this.rootWidget) return;
const teamCount = teams.size;
const columnWidth = 60;
const totalColumnsWidth = (teamCount * columnWidth) + ((teamCount - 1) * this.COLUMN_SPACING);
this.rootWidget = modlib.ParseUI({
type: "Container",
size: [totalColumnsWidth, this.ROOT_HEIGHT],
position: [0, 0],
anchor: mod.UIAnchor.TopCenter,
bgFill: mod.UIBgFill.Blur,
bgColor: [0, 0, 0],
bgAlpha: 0.0
})!;
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
let currentX = -(totalColumnsWidth / 2) + (columnWidth / 2);
for (const [teamId, team] of teams.entries()) {
const columnPos = [currentX, 0];
const column = new TeamColumnWidget(team, columnPos, [50, 30], this.teamRow, false);
this.teamColumns.set(teamId, column);
currentX += columnWidth + this.COLUMN_SPACING;
}
this.refresh();
}
refresh(): void {
if (!this.rootWidget) return;
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
for (const [teamId, column] of this.teamColumns.entries()) {
column.update();
const isLeading = leadingTeams.length === 1 && leadingTeams[0] === teamId;
column.setLeading(isLeading);
}
}
close(): void {
for (const [teamId, column] of this.teamColumns.entries()) {
column.scoreTicker.destroy();
column.flagIcon.Destroy();
}
this.teamColumns.clear();
if (this.teamRow) {
mod.DeleteUIWidget(this.teamRow);
this.teamRow = undefined;
}
if (this.rootWidget) {
mod.SetUIWidgetVisible(this.rootWidget, false);
mod.DeleteUIWidget(this.rootWidget);
this.rootWidget = undefined;
}
}
isOpen(): boolean {
return this.rootWidget !== undefined;
}
}
class ClassicCTFScoreHUD implements BaseScoreboardHUD{
readonly player: mod.Player;
readonly playerId: number;
rootWidget: mod.UIWidget | undefined;
paddingTop: number = 48;
teamScoreTickers: Map<number, ScoreTicker> = new Map<number, ScoreTicker>();
teamScoreSpacing: number = 490;
teamScorePaddingTop: number = 28;
teamWidgetSize: number[] = [76, 30];
timerTicker: RoundTimer | undefined;
timerWidgetSize: number[] = [74, 22];
flagBar: FlagBar | undefined;
flagBarWidthPadding = 20;
flagBarHeight = 12;
constructor(player?: mod.Player) {
this.player = (null as any);
this.playerId = -1;
this.create();
}
create(): void {
if (this.rootWidget) return;
this.rootWidget = modlib.ParseUI({
type: "Container",
size: [700, 50],
position: [0, this.paddingTop],
anchor: mod.UIAnchor.TopCenter,
bgFill: mod.UIBgFill.Blur,
bgColor: [0, 0, 0],
bgAlpha: 0.0
})!;
for (const [teamId, team] of teams.entries()) {
if (teamId === 0) continue;
let tickerParams: ScoreTickerParams = {
parent: this.rootWidget,
position: [((teamId - 1) * this.teamScoreSpacing) - this.teamScoreSpacing * 0.5, this.teamScorePaddingTop],
size: this.teamWidgetSize,
team: team
};
this.teamScoreTickers.set(teamId, new ScoreTicker(tickerParams));
}
const barWidth = this.teamScoreSpacing - this.teamWidgetSize[0] - this.flagBarWidthPadding;
const barPosX = 0;
const barPosY = this.teamScorePaddingTop + (this.teamWidgetSize[1] / 2) - (this.flagBarHeight * 0.5);
const team1 = teams.get(1);
const team2 = teams.get(2);
if (team1 && team2) {
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
this.timerTicker = new RoundTimer({
position: [0, 0],
parent: this.rootWidget,
textSize: 26,
size: this.timerWidgetSize,
bgAlpha: 0.5,
textColor: mod.CreateVector(0.9, 0.9, 0.9)
});
this.refresh();
}
refresh(): void {
if (!this.rootWidget) return;
for(let [teamId, widget] of this.teamScoreTickers.entries()){
widget.refresh();
}
this.timerTicker?.refresh();
this.flagBar?.update(flags, 1.0);
}
close(): void {
for (const [teamId, ticker] of this.teamScoreTickers.entries()) {
ticker.destroy();
}
this.teamScoreTickers.clear();
if (this.flagBar) {
this.flagBar.destroy();
this.flagBar = undefined;
}
if (this.timerTicker) {
this.timerTicker.destroy();
this.timerTicker = undefined;
}
if (this.rootWidget) {
mod.SetUIWidgetVisible(this.rootWidget, false);
mod.DeleteUIWidget(this.rootWidget);
this.rootWidget = undefined;
}
}
isOpen(): boolean {
return this.rootWidget !== undefined;
}
}
class GlobalScoreboardHUD {
private static instance: GlobalScoreboardHUD | null = null;
private globalHUD: BaseScoreboardHUD | null = null;
private constructor() {
}
static getInstance(): GlobalScoreboardHUD {
if (!GlobalScoreboardHUD.instance) {
GlobalScoreboardHUD.instance = new GlobalScoreboardHUD();
}
return GlobalScoreboardHUD.instance;
}
createGlobalHUD(hudClass: new (player?: mod.Player) => BaseScoreboardHUD): void {
if (this.globalHUD) {
console.log("GlobalScoreboardHUD: Global HUD already exists, skipping creation");
return;
}
this.globalHUD = new hudClass();
if (DEBUG_MODE) {
console.log(`GlobalScoreboardHUD: Created global ${hudClass.name} instance`);
}
}
refresh(): void {
if (this.globalHUD) {
this.globalHUD.refresh();
}
}
close(): void {
if (this.globalHUD) {
this.globalHUD.close();
this.globalHUD = null;
}
}
static reset(): void {
if (GlobalScoreboardHUD.instance) {
GlobalScoreboardHUD.instance.close();
GlobalScoreboardHUD.instance = null;
}
}
getHUD(): BaseScoreboardHUD | null {
return this.globalHUD;
}
}
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
this.rootWidget = modlib.ParseUI({
type: "Container",
size: [400, 30],
position: this.position,
anchor: mod.UIAnchor.TopCenter,
bgFill: mod.UIBgFill.Blur,
bgColor: [0, 0, 0],
bgAlpha: 0.0,
teamId: team
})!;
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
static create(team: mod.Team): TeamScoreboardHUD {
const teamId = mod.GetObjId(team);
let instance = TeamScoreboardHUD.instances.get(teamId);
if (!instance) {
instance = new TeamScoreboardHUD(team);
TeamScoreboardHUD.instances.set(teamId, instance);
}
return instance;
}
static getInstance(teamId: number): TeamScoreboardHUD | undefined {
return TeamScoreboardHUD.instances.get(teamId);
}
static getAllInstances(): TeamScoreboardHUD[] {
return Array.from(TeamScoreboardHUD.instances.values());
}
refresh(): void {
this.teamOrdersBar.refresh();
}
close(): void {
if (this.teamOrdersBar) {
this.teamOrdersBar.destroy();
}
if (this.rootWidget) {
mod.SetUIWidgetVisible(this.rootWidget, false);
mod.DeleteUIWidget(this.rootWidget);
}
}
isOpen(): boolean {
return this.rootWidget !== undefined && mod.GetUIWidgetVisible(this.rootWidget);
}
static destroyAll(): void {
for (const [teamId, instance] of TeamScoreboardHUD.instances.entries()) {
instance.close();
}
TeamScoreboardHUD.instances.clear();
if (DEBUG_MODE) {
console.log('All team scoreboards destroyed');
}
}
static reset(): void {
TeamScoreboardHUD.destroyAll();
}
}
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
const root = modlib.ParseUI({
type: "Container",
size: [400, 30],
position: [0, 150],
anchor: mod.UIAnchor.TopCenter,
bgFill: mod.UIBgFill.None,
bgColor: [0, 0, 0],
bgAlpha: 0.0,
playerId: this.player
})!;
this.rootWidget = root;
if (DEBUG_MODE) {
console.log(`PlayerScoreboardHUD: Created player-scoped HUD container for player ${this.playerId}`);
}
this.refresh();
}
refresh(): void {
if (!this.rootWidget) return;
}
close(): void {
if (this.rootWidget) {
mod.SetUIWidgetVisible(this.rootWidget, false);
}
}
isOpen(): boolean {
return this.rootWidget !== undefined && mod.GetUIWidgetVisible(this.rootWidget);
}
}
interface TeamConfig {
teamId: number;
name?: string;
color?: mod.Vector;
captureZones?: CaptureZoneConfig[]
}
interface FlagConfig {
flagId: number;
owningTeamId: TeamID;
allowedCapturingTeams?: number[];
customColor?: mod.Vector;
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
let currentHUDClass: (new (player?: mod.Player) => BaseScoreboardHUD) | undefined;
function LoadGameModeConfig(config: GameModeConfig): void {
currentHUDClass = config.HUDClass;
teams.clear();
teamConfigs.clear();
teamScores.clear();
flags.clear();
for (const teamConfig of config.teams) {
const team = mod.GetTeam(teamConfig.teamId);
teams.set(teamConfig.teamId, team);
console.log(`Loading team config for ${teamConfig.teamId}. Colour is ${teamConfig.name}`);
teamConfigs.set(teamConfig.teamId, teamConfig);
teamScores.set(teamConfig.teamId, 0);
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
}
} else {
console.log(`Using CustomFFA scoreboard`);
mod.SetScoreboardType(mod.ScoreboardType.CustomFFA);
mod.SetScoreboardColumnNames(
mod.Message(mod.stringkeys.scoreboard_team_label),
mod.Message(mod.stringkeys.scoreboard_captures_label),
mod.Message(mod.stringkeys.scoreboard_capture_assists_label),
mod.Message(mod.stringkeys.scoreboard_carrier_kills_label)
);
mod.SetScoreboardColumnWidths(0.2, 0.2, 0.2, 0.4);
mod.SetScoreboardSorting(0, false);
}
for (const flagConfig of config.flags) {
const team = teams.get(flagConfig.owningTeamId);
if (!team) {
console.error(`Team ${flagConfig.owningTeamId} not found for flag ${flagConfig.flagId}`);
continue;
}
const flagSpawn = mod.GetSpatialObject(flagConfig.spawnObjectId ?? GetDefaultFlagSpawnIdForTeam(mod.GetTeam(flagConfig.owningTeamId)));
const flagPosition = mod.GetObjectPosition(flagSpawn);
const flag = new Flag(
team,
flagPosition,
flagConfig.flagId,
flagConfig.allowedCapturingTeams,
flagConfig.customColor
);
flags.set(flagConfig.flagId, flag);
if (DEBUG_MODE) {
console.log(`Initialized flag ${flagConfig.flagId} for team ${flagConfig.owningTeamId} at ${VectorToString(flagPosition)}`);
}
}
if (DEBUG_MODE) {
console.log(`Loaded ${config.teams.length} teams and ${config.flags.length} flags`);
}
}
const ClassicCTFConfig: GameModeConfig = {
HUDClass: ClassicCTFScoreHUD,
teams: [
{
teamId: TeamID.TEAM_1,
name: mod.stringkeys.purple_team_name,
color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_1),
captureZones: [
{
team: mod.GetTeam(TeamID.TEAM_1)
}
]
},
{
teamId: TeamID.TEAM_2,
name: mod.stringkeys.orange_team_name,
color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_2),
captureZones: [
{
team: mod.GetTeam(TeamID.TEAM_2)
}
]
}
],
flags: [
{
flagId: 1,
owningTeamId: TeamID.TEAM_1,
},
{
flagId: 2,
owningTeamId: TeamID.TEAM_2,
}
]
}
const FourTeamCTFConfig: GameModeConfig = {
HUDClass: MultiTeamScoreHUD,
teams: [
{
teamId: 1,
name: mod.stringkeys.purple_team_name,
color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_1),
captureZones: [
{
team: mod.GetTeam(TeamID.TEAM_1)
}
]
},
{
teamId: 2,
name: mod.stringkeys.orange_team_name,
color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_2),
captureZones: [
{
team: mod.GetTeam(TeamID.TEAM_2)
}
]
},
{ teamId: 3,
name: mod.stringkeys.green_team_name,
color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_3),
captureZones: [
{
team: mod.GetTeam(TeamID.TEAM_3)
}
]
},
{
teamId: 4,
name: mod.stringkeys.blue_team_name,
color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_4),
captureZones: [
{
team: mod.GetTeam(TeamID.TEAM_4)
}
]
}
],
flags: [
{
flagId: 1,
owningTeamId: TeamID.TEAM_1,
},
{
flagId: 2,
owningTeamId: TeamID.TEAM_2,
},
{
flagId: 3,
owningTeamId: TeamID.TEAM_3,
},
{
flagId: 4,
owningTeamId: TeamID.TEAM_4,
}
]
}
const DEFAULT_GAMEMODES = new Map<number, GameModeConfig>([
[40000, ClassicCTFConfig],
[40001, FourTeamCTFConfig]
]);
async function CheckAndBalanceTeams(): Promise<void> {
if (!TEAM_AUTO_BALANCE || balanceInProgress || !gameStarted) return;
const currentTime = GetCurrentTime();
if (currentTime - lastBalanceCheckTime < TEAM_BALANCE_CHECK_INTERVAL) return;
lastBalanceCheckTime = currentTime;
const teamPlayerCounts: { teamId: number, team: mod.Team, players: mod.Player[], count: number }[] = [];
for (const [teamId, team] of teams.entries()) {
const players = GetPlayersInTeam(team);
teamPlayerCounts.push({ teamId, team, players, count: players.length });
}
teamPlayerCounts.sort((a, b) => b.count - a.count);
const largestTeam = teamPlayerCounts[0];
const smallestTeam = teamPlayerCounts[teamPlayerCounts.length - 1];
if (Math.abs(largestTeam.count - smallestTeam.count) <= 1) return;
balanceInProgress = true;
mod.DisplayNotificationMessage(
mod.Message(mod.stringkeys.team_balance_notif)
);
await mod.Wait(TEAM_BALANCE_DELAY);
const updatedTeamCounts: { teamId: number, team: mod.Team, players: mod.Player[], count: number }[] = [];
for (const [teamId, team] of teams.entries()) {
const players = GetPlayersInTeam(team);
updatedTeamCounts.push({ teamId, team, players, count: players.length });
}
updatedTeamCounts.sort((a, b) => b.count - a.count);
const updatedLargest = updatedTeamCounts[0];
const updatedSmallest = updatedTeamCounts[updatedTeamCounts.length - 1];
if (Math.abs(updatedLargest.count - updatedSmallest.count) <= 1) {
balanceInProgress = false;
return;
}
const jsPlayers: JSPlayer[] = [];
for (const player of updatedLargest.players) {
const jsPlayer = JSPlayer.get(player);
if (jsPlayer) jsPlayers.push(jsPlayer);
}
jsPlayers.sort((a, b) => b.joinOrder - a.joinOrder);
const playersToMove = Math.floor((updatedLargest.count - updatedSmallest.count) / 2);
for (let i = 0; i < playersToMove && i < jsPlayers.length; i++) {
if (jsPlayers[i].player && updatedSmallest.team) {
try{
mod.SetTeam(jsPlayers[i].player, updatedSmallest.team);
jsPlayers[i].resetUI();
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