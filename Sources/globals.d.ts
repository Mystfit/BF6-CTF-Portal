/**
 * Global declarations for CTF game mode
 * 
 * This file declares all global variables, functions, and classes that are
 * defined in CTF.ts and used across multiple split files. Since Compile.bat
 * concatenates all files together, these symbols will be available at runtime,
 * but we need to declare them so TypeScript/VSCode knows they exist.
 * 
 * IMPORTANT: This file must NOT contain any import/export statements!
 * Import statements turn a .d.ts file into a module, which scopes all
 * declarations to that module instead of making them global.
 * All imports should go in imports.ts instead.
 */

// ============================================================================
// MODLIB NAMESPACE
// ============================================================================
// Declare modlib so VSCode knows it exists (actual import is in imports.ts)

declare namespace modlib {
    function Concat(s1: string, s2: string): string;
    function And(...rest: boolean[]): boolean;
    function AndFn(...rest: (() => boolean)[]): boolean;
    function getPlayerId(player: mod.Player): number;
    function getTeamId(team: mod.Team): number;
    function ConvertArray(array: mod.Array): any[];
    function FilteredArray(array: mod.Array, cond: (currentElement: any) => boolean): mod.Array;
    function IndexOfFirstTrue(array: mod.Array, cond: (element: any, arg: any) => boolean, arg?: any): number;
    function IfThenElse<T>(condition: boolean, ifTrue: () => T, ifFalse: () => T): T;
    function IsTrueForAll(array: mod.Array, condition: (element: any, arg: any) => boolean, arg?: any): boolean;
    function IsTrueForAny(array: mod.Array, condition: (element: any, arg: any) => boolean, arg?: any): boolean;
    function SortedArray(array: any[], compare: (a: any, b: any) => number): any[];
    function Equals(a: any, b: any): boolean;
    function WaitUntil(delay: number, cond: () => boolean): Promise<void>;
    
    class ConditionState {
        lastState: boolean;
        constructor();
        update(newState: boolean): boolean;
    }
    
    function getPlayerCondition(obj: mod.Player, n: number): ConditionState;
    function getTeamCondition(team: mod.Team, n: number): ConditionState;
    function getCapturePointCondition(obj: mod.CapturePoint, n: number): ConditionState;
    function getMCOMCondition(obj: mod.MCOM, n: number): ConditionState;
    function getVehicleCondition(obj: mod.Vehicle, n: number): ConditionState;
    function getGlobalCondition(n: number): ConditionState;
    function getPlayersInTeam(team: mod.Team): mod.Player[];
    
    // UI Helper function - most commonly used
    function ParseUI(...params: any[]): mod.UIWidget | undefined;
    
    // Message display functions
    function DisplayCustomNotificationMessage(msg: mod.Message, custom: mod.CustomNotificationSlots, duration: number, target?: mod.Player | mod.Team): void;
    function ShowEventGameModeMessage(event: mod.Message, target?: mod.Player | mod.Team): void;
    function ShowHighlightedGameModeMessage(event: mod.Message, target?: mod.Player | mod.Team): void;
    function ShowNotificationMessage(msg: mod.Message, target?: mod.Player | mod.Team): void;
    function ClearAllCustomNotificationMessages(target: mod.Player): void;
    function ClearCustomNotificationMessage(custom: mod.CustomNotificationSlots, target?: mod.Player | mod.Team): void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

declare const DEBUG_MODE: boolean;
declare const GAMEMODE_TARGET_SCORE: number;
declare const FLAG_PICKUP_DELAY: number;
declare const FLAG_AUTO_RETURN_TIME: number;
declare const FLAG_SFX_DURATION: number;
declare const FLAG_ICON_HEIGHT_OFFSET: number;
declare const FLAG_PROP: mod.RuntimeSpawn_Common;
declare const FLAG_THROW_SPEED: number;
declare const CARRIER_FORCED_WEAPON: mod.Gadgets;
declare const CARRIER_FORCED_WEAPON_SLOT: mod.InventorySlots;
declare const CARRIER_CAN_HOLD_MULTIPLE_FLAGS: boolean;
declare const TEAM_AUTO_BALANCE: boolean;
declare const TEAM_BALANCE_DELAY: number;
declare const TEAM_BALANCE_CHECK_INTERVAL: number;
declare const FLAG_DROP_DISTANCE: number;
declare const FLAG_INTERACTION_HEIGHT_OFFSET: number;
declare const FLAG_SPAWN_HEIGHT_OFFSET: number;
declare const FLAG_COLLISION_RADIUS: number;
declare const FLAG_COLLISION_RADIUS_OFFSET: number;
declare const FLAG_DROP_RAYCAST_DISTANCE: number;
declare const FLAG_DROP_RING_RADIUS: number;
declare const FLAG_ENABLE_ARC_THROW: boolean;
declare const FLAG_TERRAIN_RAYCAST_SUPPORT: boolean;
declare const SOLDIER_HALF_HEIGHT: number;
declare const SOLDIER_HEIGHT: number;
declare const SPAWN_VALIDATION_DIRECTIONS: number;
declare const SPAWN_VALIDATION_MAX_ITERATIONS: number;
declare const SPAWN_VALIDATION_HEIGHT_OFFSET: number;
declare const VEHICLE_DRIVER_SEAT: number;
declare const VEHICLE_FIRST_PASSENGER_SEAT: number;
declare const TICK_RATE: number;
declare const ZERO_VEC: mod.Vector;
declare const ONE_VEC: mod.Vector;
declare const NEUTRAL_COLOR: mod.Vector;
declare const DEFAULT_TEAM_COLOURS: Map<number, mod.Vector>;
declare const DEFAULT_TEAM_NAMES: Map<number, string>;
declare const DEFAULT_TEAM_VO_FLAGS: Map<number, mod.VoiceOverFlags | undefined>;

// HQ IDs
declare const TEAM1_HQ_ID: number;
declare const TEAM2_HQ_ID: number;
declare const TEAM3_HQ_ID: number;
declare const TEAM4_HQ_ID: number;
declare const TEAM5_HQ_ID: number;
declare const TEAM6_HQ_ID: number;
declare const TEAM7_HQ_ID: number;

// Object ID offsets
declare const TEAM_ID_START_OFFSET: number;
declare const TEAM_ID_STRIDE_OFFSET: number;

// ============================================================================
// ENUMS
// ============================================================================

declare enum TeamID {
    TEAM_NEUTRAL = 0,
    TEAM_1 = 1,
    TEAM_2 = 2,
    TEAM_3 = 3,
    TEAM_4 = 4,
    TEAM_5 = 5,
    TEAM_6 = 6,
    TEAM_7 = 7
}

declare enum FlagIdOffsets {
    FLAG_INTERACT_ID_OFFSET = 1,
    FLAG_CAPTURE_ZONE_ID_OFFSET = 2,
    FLAG_CAPTURE_ZONE_ICON_ID_OFFSET = 3,
    FLAG_SPAWN_ID_OFFSET = 4
}

// ============================================================================
// INTERFACES
// ============================================================================

// Configuration interfaces
interface TeamConfig {
    teamId: number;
    name?: string;
    color?: mod.Vector;
    hqId?: number;
    captureZones?: CaptureZoneConfig[];
}

interface FlagConfig {
    flagId: number;
    owningTeamId: TeamID;
    allowedCapturingTeams?: number[];
    customColor?: mod.Vector;
    spawnObjectId?: number;
}

interface GameModeConfig {
    teams: TeamConfig[];
    flags: FlagConfig[];
}

// Raycast interfaces
interface RaycastResult {
    hit: boolean;
    ID: number;
    player?: mod.Player;
    point: mod.Vector;
    normal?: mod.Vector;
}

interface ProjectileRaycastResult {
    hit: boolean;
    arcPoints: mod.Vector[];
    rayIds: number[];
    hitPosition?: mod.Vector;
    hitNormal?: mod.Vector;
}

interface ProjectilePoint {
    position: mod.Vector;
    rayId: number;
    hit: boolean;
    hitNormal?: mod.Vector;
    isLast: boolean;
}

interface ValidatedSpawnResult {
    position: mod.Vector;
    isValid: boolean;
}

// ============================================================================
// CLASSES
// ============================================================================

declare class rgba {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r: number, g: number, b: number, a?: number);
    NormalizeToLinear(): rgba;
    AsModVector3(): mod.Vector;
    static FromModVector3(vector: mod.Vector): rgba;
}

declare class AnimationManager {
    AnimateAlongPath(object: mod.Object, points: mod.Vector[], options?: any): Promise<void>;
    AnimateAlongGeneratedPath(object: mod.Object, generator: AsyncGenerator<ProjectilePoint>, minBufferSize: number, options?: any): Promise<void>;
    AnimateToPosition(object: mod.Object, targetPos: mod.Vector, duration: number, options?: any): Promise<void>;
    StopAnimation(object: mod.Object): void;
    IsAnimating(object: mod.Object): boolean;
    GetAnimationProgress(object: mod.Object): number;
    PauseAnimation(object: mod.Object): void;
    ResumeAnimation(object: mod.Object): void;
    StopAllAnimations(): void;
}

declare class PlayerScore {
    captures: number;
    capture_assists: number;
    flag_carrier_kills: number;
    constructor(captures?: number, capture_assists?: number, flag_carrier_kills?: number);
}

declare class JSPlayer {
    readonly player: mod.Player;
    readonly playerId: number;
    score: PlayerScore;
    readonly joinOrder: number;
    heldFlags: Flag[];
    lastPosition: mod.Vector;
    velocity: mod.Vector;
    scoreboardUI?: BaseScoreboardHUD;
    static playerInstances: mod.Player[];
    constructor(player: mod.Player);
    static get(player: mod.Player): JSPlayer | undefined;
    static removeInvalidJSPlayers(invalidPlayerId: number): void;
    static getAllAsArray(): JSPlayer[];
}

declare class Flag {
    readonly flagId: number;
    readonly owningTeamId: number;
    readonly allowedCapturingTeams: number[];
    customColor?: mod.Vector;
    readonly team: mod.Team;
    readonly teamId: number;
    readonly homePosition: mod.Vector;
    currentPosition: mod.Vector;
    isAtHome: boolean;
    isBeingCarried: boolean;
    isDropped: boolean;
    canBePickedUp: boolean;
    numFlagTimesPickedUp: number;
    carrierPlayer: mod.Player | null;
    dropTime: number;
    autoReturnTime: number;
    flagRecoverIcon: mod.WorldIcon;
    flagCarriedIcons: Map<number, mod.WorldIcon>;
    flagInteractionPoint: mod.InteractPoint | null;
    flagProp: mod.Object | null;
    flagHomeVFX: mod.VFX;
    alarmSFX: mod.SFX | null;
    
    constructor(team: mod.Team, homePosition: mod.Vector, flagId?: number, allowedCapturingTeams?: number[], customColor?: mod.Vector);
    Initialize(): void;
    SpawnFlagAtHome(): void;
    PickupFlag(player: mod.Player): void;
    DropFlag(position?: mod.Vector, direction?: mod.Vector, dropDistance?: number): Promise<void>;
    UpdateFlagInteractionPoint(): void;
    StartPickupDelay(): Promise<void>;
    ReturnFlag(): void;
    ResetFlag(): void;
    CheckAutoReturn(): void;
    StartAutoReturn(returnDelay: number, expectedNumTimesPickedUp: number): Promise<void>;
    SlowUpdate(timeDelta: number): void;
    FastUpdate(timeDelta: number): void;
    UpdateCarrier(timeDelta: number): void;
    UpdateCarrierIcon(): void;
    RestrictCarrierWeapons(player: mod.Player): void;
    CheckCarrierDroppedFlag(player: mod.Player): void;
    RestoreCarrierWeapons(player: mod.Player): void;
    IsPlayerOnThisTeam(player: mod.Player): boolean;
    CanBePickedUpBy(playerTeamId: number): boolean;
    GetFlagColor(): mod.Vector;
    PlayFlagAlarm(): Promise<void>;
    PlayFlagTakenVO(): void;
    StopFlagAlarm(): void;
    PlayFlagReturnedSFX(): void;
}

declare class CaptureZoneConfig {
    team: mod.Team;
    captureZoneID?: number;
    captureZoneSpatialObjId?: number;
    constructor(team: mod.Team, captureZoneID?: number, captureZoneSpatialObjId?: number);
}

declare class CaptureZone {
    readonly team: mod.Team;
    readonly teamId: number;
    readonly areaTrigger: mod.AreaTrigger | undefined;
    readonly captureZoneID?: number;
    readonly captureZoneSpatialObjId?: number;
    readonly iconPosition: mod.Vector;
    readonly baseIcons?: Map<number, mod.WorldIcon>;
    
    constructor(team: mod.Team, captureZoneID?: number, captureZoneSpatialObjId?: number);
    UpdateIcons(): void;
    HandleCaptureZoneEntry(player: mod.Player): void;
}

declare class RaycastManager {
    static Get(): RaycastManager;
    static cast(start: mod.Vector, stop: mod.Vector, debug?: boolean, debugDuration?: number): Promise<RaycastResult>;
    static castWithPlayer(player: mod.Player, start: mod.Vector, stop: mod.Vector, debug?: boolean, debugDuration?: number): Promise<RaycastResult>;
    handleHit(player: mod.Player, point: mod.Vector, normal: mod.Vector): void;
    handleMiss(player: mod.Player): void;
    getQueueLength(): number;
    static VisualizePoints(points: mod.Vector[], color?: mod.Vector, debugDuration?: number, rayIds?: number[], iconImage?: mod.WorldIconImages): Promise<void>;
    static ProjectileRaycast(startPosition: mod.Vector, velocity: mod.Vector, distance: number, sampleRate: number, player?:mod.Player | null, gravity?: number, debug?: boolean, debugDuration?: number): Promise<ProjectileRaycastResult>;
    static ProjectileRaycastGenerator(startPosition: mod.Vector, velocity: mod.Vector, distance: number, sampleRate: number, player?: mod.Player | null, gravity?: number, debug?: boolean, interpolationSteps?: number, onHitDetected?: (hitPoint: mod.Vector, hitNormal?: mod.Vector) => Promise<mod.Vector>): AsyncGenerator<ProjectilePoint>;
    static FindValidGroundPosition(startPosition: mod.Vector, direction: mod.Vector, forwardDistance: number, collisionRadius: number, downwardDistance: number, debug?: boolean, debugDuration?: number): Promise<RaycastResult>;
    static ValidateSpawnLocationWithRadialCheck(centerPosition: mod.Vector, checkRadius: number, checkRadiusOffset: number, numDirections: number, downwardDistance: number, maxIterations?: number, debug?: boolean): Promise<ValidatedSpawnResult>;
    static GetID(): number;
    static GetNextID(): number;
}

declare class TeamColumnWidget {
    readonly teamId: number;
    readonly team: mod.Team;
    readonly isPlayerTeam: boolean;
    readonly columnWidget: mod.UIWidget;
    readonly scoreWidget: mod.UIWidget;
    readonly flagStatusWidget: mod.UIWidget;
    readonly verticalPadding: number;
    constructor(team: mod.Team, position: mod.Vector, size: number[], parent: mod.UIWidget, isPlayerTeam: boolean);
    update(): void;
}

declare interface BaseScoreboardHUD {
    readonly player: mod.Player;
    readonly playerId: number;
    readonly rootWidget: mod.UIWidget | undefined;
    create(): void;
    refresh(): void;
    close(): void;
    isOpen(): boolean;
}

declare class MultiTeamScoreHUD {
    readonly player: mod.Player;
    readonly playerId: number;
    readonly rootWidget: mod.UIWidget | undefined;
    
    constructor(player: mod.Player);
    create(): void;
    refresh(): void;
    close(): void;
    isOpen(): boolean;
}

declare class ClassicCTFScoreHUD {
    readonly player: mod.Player;
    readonly playerId: number;
    readonly rootWidget: mod.UIWidget | undefined;

    constructor(player: mod.Player);
    create(): void;
    refresh(): void;
    close(): void;
    isOpen(): boolean;
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

declare class FlagIcon {
    constructor(params: FlagIconParams);
    SetFillVisible(visible: boolean): void;
    SetOutlineVisible(visible: boolean): void;
    IsFillVisible(): boolean;
    IsOutlineVisible(): boolean;
    SetFillColor(color: mod.Vector, alpha?: number): void;
    SetFillAlpha(alpha: number): void;
    SetOutlineColor(color: mod.Vector, alpha?: number): void;
    SetOutlineAlpha(alpha:number): void;
    SetColor(color: mod.Vector, alpha?: number): void;
    SetPosition(position: mod.Vector): void;
    SetParent(parent: mod.UIWidget): void;
    IsVisible(): boolean;
    SetVisible(visible: boolean): void;
    Destroy(): void;
    GetRootWidget(): mod.UIWidget;
}

declare class ScoreTicker {

}

// ============================================================================
// NAMESPACES
// ============================================================================

declare namespace Math2 {
    class Vec3 {
        x: number;
        y: number;
        z: number;
        constructor(x: number, y: number, z: number);
        static FromVector(vector: mod.Vector): Vec3;
        ToVector(): mod.Vector;
        Subtract(other: Vec3): Vec3;
        Multiply(other: Vec3): Vec3;
        MultiplyScalar(scalar: number): Vec3;
        Add(other: Vec3): Vec3;
    }
}

declare function AreFloatsEqual(a: number, b: number, epsilon?: number): boolean;

// ============================================================================
// GLOBAL INSTANCES
// ============================================================================

declare const animationManager: AnimationManager;
declare const raycastManager: RaycastManager;

// ============================================================================
// GLOBAL STATE
// ============================================================================

declare let gameStarted: boolean;
declare let lastBalanceCheckTime: number;
declare let balanceInProgress: boolean;
declare let teamNeutral: mod.Team;
declare let team1: mod.Team;
declare let team2: mod.Team;
declare let team3: mod.Team;
declare let team4: mod.Team;
declare let lastTickTime: number;
declare let lastSecondUpdateTime: number;
declare let teams: Map<number, mod.Team>;
declare let teamConfigs: Map<number, TeamConfig>;
declare let teamScores: Map<number, number>;
declare let flags: Map<number, Flag>;
declare let captureZones: Map<number, CaptureZone>;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

declare function GetCurrentTime(): number;
declare function GetRandomInt(max: number): number;
declare function VectorToString(v: mod.Vector): string;
declare function VectorClampToRange(vector: mod.Vector, min:number, max:number): mod.Vector;
declare function VectorLength(vec: mod.Vector): number;
declare function VectorLengthSquared(vec: mod.Vector): number;
declare function GetTeamName(team: mod.Team): string;
declare function GetOpposingTeams(teamId: number): number[];
declare function GetOpposingTeamsForFlag(flagData: Flag): number[];
declare function GetTeamColorById(teamId: number): mod.Vector;
declare function GetTeamColor(team: mod.Team): mod.Vector;
declare function GetTeamDroppedColor(team: mod.Team): mod.Vector;
declare function IsCarryingAnyFlag(player: mod.Player): boolean;
declare function DropAllFlags(player: mod.Player): void;
declare function GetCarriedFlags(player: mod.Player): Flag[];
declare function GetPlayersInTeam(team: mod.Team): mod.Player[];
declare function CaptureFeedback(pos: mod.Vector): void;
declare function NormalizeColour(r: number, g: number, b: number): [number, number, number];
declare function LerpVector(start: mod.Vector, end: mod.Vector, alpha: number): mod.Vector;
declare function InterpolatePoints(points: mod.Vector[], numPoints: number): mod.Vector[];

// ============================================================================
// GAME LOGIC FUNCTIONS
// ============================================================================

declare function HandleFlagInteraction(player: mod.Player, playerTeamId: number, flag: Flag): void;
declare function UpdatePlayerScoreboard(player: mod.Player): void;
declare function ScoreCapture(scoringPlayer: mod.Player, capturedFlag: Flag, scoringTeam: mod.Team): void;
declare function ForceToPassengerSeat(player: mod.Player, vehicle: mod.Vehicle): void;
declare function EndGameByScore(winningTeamId: number): void;
declare function EndGameByTime(): void;
declare function CheckAndBalanceTeams(): Promise<void>;
declare function RefreshScoreboard(): void;

// ============================================================================
// CONFIGURATION FUNCTIONS
// ============================================================================

declare function LoadGameModeConfig(config: GameModeConfig): void;
declare const ClassicCTFConfig: GameModeConfig;
declare const FourTeamCTFConfig: GameModeConfig;

// ============================================================================
// FLAG/ZONE HELPER FUNCTIONS
// ============================================================================

declare function GetFlagTeamIdOffset(team: mod.Team): number;
declare function GetDefaultFlagCaptureZoneAreaTriggerIdForTeam(team: mod.Team): number;
declare function GetDefaultFlagCaptureZoneSpatialIdForTeam(team: mod.Team): number;
declare function GetDefaultFlagSpawnIdForTeam(team: mod.Team): number;

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

declare function BuildFlagStatus(flag: Flag): mod.Message;
