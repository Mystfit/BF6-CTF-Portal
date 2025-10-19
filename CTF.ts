try{throw Error("Line offset check");} catch(error: unknown){if(error instanceof Error) console.log(`Script line offset: ${error.stack}`);};
/* 
 * Capture the Flag Game Mode
 * 
 * Two teams compete to capture the enemy flag and return it to their base.
 * First team to reach the target score wins.
 * Author: Mystfit and Claude Sonnet 4.5 (20250929).
 */

//@ts-ignore
import * as modlib from 'modlib';

const VERSION = [1, 1, 0];


//==============================================================================================
// CONFIGURATION
//==============================================================================================

const DEBUG_MODE = true;                                            // Print extra debug messages

// Game Settings
const TARGET_SCORE = 5;                                             // Points needed to win

// Flag settings
const FLAG_PICKUP_DELAY = 3;                                        // Seconds before dropped flag can be picked up
const FLAG_AUTO_RETURN_TIME = 30;                                   // Seconds before dropped flag auto-returns to base
const FLAG_SFX_DURATION = 5.0;                                      // Time delay before alarm sound shuts off
const FLAG_ICON_HEIGHT_OFFSET = 2.5;                                // Height that the flag icon should be placed above a flag
const FLAG_PROP = mod.RuntimeSpawn_Common.ServerRack_01;            // Prop representing a flag at a spawner and when dropped

// Flag carrier settings
const CARRIER_FORCED_WEAPON = mod.Gadgets.Melee_Sledgehammer;       // Weapon to automatically give to a flag carrier when a flag is picked up
const CARRIER_FORCED_WEAPON_SLOT = mod.InventorySlots.MeleeWeapon;  // Force flag carrier to swap to this slot on flag pickup, swapping will drop flag
const CARRIER_CAN_HOLD_MULTIPLE_FLAGS = true;                       // Let the flag carrier pick up multiple flags at once

// Team balance
const AUTO_TEAM_BALANCE: boolean = true;                            // Make sure teams are evenly balanced 
const TEAM_BALANCE_DELAY = 5.0;                                     // Seconds to delay before auto-balancing teams
const TEAM_BALANCE_CHECK_INTERVAL = 10;                             // Check balance every N seconds


//==============================================================================================
// CONSTANTS - (you probably won't need to modify these)
//==============================================================================================

// HQ ids
const TEAM1_HQ_ID = 1;
const TEAM2_HQ_ID = 2;
const TEAM3_HQ_ID = 3;
const TEAM4_HQ_ID = 4;

enum TeamID {
    TEAM_NEUTRAL = 0,
    TEAM_1,
    TEAM_2,
    TEAM_3,
    TEAM_4
}
const DEFAULT_TEAM_NAMES = new Map<number, string>([
    [TeamID.TEAM_NEUTRAL, mod.stringkeys.neutral_team_name],
    [TeamID.TEAM_1, mod.stringkeys.purple_team_name],
    [TeamID.TEAM_2, mod.stringkeys.purple_team_name],
    [TeamID.TEAM_3, mod.stringkeys.green_team_name],
    [TeamID.TEAM_4, mod.stringkeys.blue_team_name]
]);

enum FlagIdOffsets{
    FLAG_INTERACT_ID_OFFSET = 1,
    FLAG_CAPTURE_ZONE_ID_OFFSET = 2,
    FLAG_CAPTURE_ZONE_ICON_ID_OFFSET = 3,
    FLAG_SPAWN_ID_OFFSET = 4
}

// Object IDs offsets for flag spawners and capture zones added in Godot
const TEAM_ID_START_OFFSET = 100;
const TEAM_ID_STRIDE_OFFSET = 10;

// Wrapper class to handle colour conversions
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
const TEAM1_COLOR = new rgba(216, 6, 249, 1).NormalizeToLinear().AsModVector3();
const TEAM2_COLOR = new rgba(249, 95, 6, 1).NormalizeToLinear().AsModVector3();
const TEAM3_COLOR = new rgba(39, 249, 6, 1).NormalizeToLinear().AsModVector3();
const TEAM4_COLOR = new rgba(6, 160, 249, 1).NormalizeToLinear().AsModVector3();
const NEUTRAL_COLOR = new rgba(255, 255, 255, 1).NormalizeToLinear().AsModVector3();
const DEFAULT_TEAM_COLOURS = new Map<number, mod.Vector>([
    [TeamID.TEAM_NEUTRAL, NEUTRAL_COLOR],
    [TeamID.TEAM_1, TEAM1_COLOR],
    [TeamID.TEAM_2, TEAM2_COLOR],
    [TeamID.TEAM_3, TEAM3_COLOR],
    [TeamID.TEAM_4, TEAM4_COLOR]
]);

// Utility
const ZERO_VEC = mod.CreateVector(0, 0, 0);
const ONE_VEC = mod.CreateVector(1, 1, 1);


//==============================================================================================
// GLOBAL STATE
//==============================================================================================

let gameStarted = false;

// Team balance state
let lastBalanceCheckTime = 0;
let balanceInProgress = false;

// Team references
let team1: mod.Team;
let team2: mod.Team;
let team3: mod.Team;
let team4: mod.Team;


//==============================================================================================
// PLAYERSCORE CLASS
//==============================================================================================

class PlayerScore {
    captures: number
    capture_assists: number
    flag_carrier_kills: number

    constructor(captures: number = 0, capture_assists: number = 0, flag_carrier_kills:number = 0){
        this.captures = captures;
        this.capture_assists = capture_assists
        this.flag_carrier_kills = flag_carrier_kills
    }
}


//==============================================================================================
// JSPLAYER CLASS
//==============================================================================================

class JSPlayer {
    player: mod.Player;
    playerId: number;
    score: PlayerScore;
    joinOrder: number; // Track join order for team balancing
    heldFlags: Flag[] = [];

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
// CONFIGURATION INTERFACES
//==============================================================================================

interface TeamConfig {
    teamId: number;
    name?: string;
    color?: mod.Vector;
    hqId?: number;  // Optional, for future refactoring
    captureZones?: CaptureZoneConfig[] // Array of capture points for this team
}

interface FlagConfig {
    flagId: number;
    owningTeamId: TeamID;
    allowedCapturingTeams: number[];  // Empty = any opposing team can capture
    customColor?: mod.Vector;  // Optional color override
    spawnObjectId: number;
}

interface GameModeConfig {
    teams: TeamConfig[];
    flags: FlagConfig[];
}

// Dynamic state management
let teams: Map<number, mod.Team> = new Map();
let teamConfigs: Map<number, TeamConfig> = new Map();
let teamScores: Map<number, number> = new Map();
let flags: Map<number, Flag> = new Map();
let captureZones: Map<number, CaptureZone> = new Map();



//==============================================================================================
// CAPTURE ZONE CLASS
//==============================================================================================

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

class CaptureZone {
    team: mod.Team;
    teamId: number;
    areaTrigger: mod.AreaTrigger | undefined;
    captureZoneID?: number;
    captureZoneSpatialObjId?: number;
    iconPosition: mod.Vector;
    baseIcons?: Map<number, mod.WorldIcon>;// One icon per opposing team

    constructor(team: mod.Team, captureZoneID?: number, captureZoneSpatialObjId?:number){
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.captureZoneID = captureZoneID ? captureZoneID : GetDefaultFlagCaptureZoneAreaTriggerIdForTeam(team);
        this.captureZoneSpatialObjId = captureZoneSpatialObjId ? captureZoneSpatialObjId : GetDefaultFlagCaptureZoneSpatialIdForTeam(this.team);
        this.iconPosition = ZERO_VEC;

        this.areaTrigger = this.captureZoneID ? mod.GetAreaTrigger(this.captureZoneID) : undefined;
        if(!this.areaTrigger)
            console.log(`Could not find team ${this.teamId} area trigger for capture zone ID ${this.captureZoneID}`);

        if(this.captureZoneSpatialObjId){
            let captureZoneSpatialObj = mod.GetSpatialObject(this.captureZoneSpatialObjId);
            if(captureZoneSpatialObj)
            {
                // Get our world icon position for this capture zone
                this.iconPosition = mod.Add(mod.GetObjectPosition(captureZoneSpatialObj), mod.CreateVector(0.0, FLAG_ICON_HEIGHT_OFFSET, 0.0));

                // Create world icons for our team         
                this.baseIcons = new Map();
                let teamIcon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, this.iconPosition, ZERO_VEC) as mod.WorldIcon;
                mod.SetWorldIconOwner(teamIcon, team);
                mod.EnableWorldIconText(teamIcon, true);
                mod.EnableWorldIconImage(teamIcon, true);
                this.baseIcons.set(mod.GetObjId(team), teamIcon);
                
                // Create world icons for opposing teams        
                let opposingTeams = GetOpposingTeams(mod.GetObjId(team));
                if(opposingTeams.length && team){
                    for(let opposingTeam of opposingTeams){
                        let opposingIcon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, this.iconPosition, ZERO_VEC) as mod.WorldIcon;
                        mod.SetWorldIconOwner(opposingIcon, mod.GetTeam(opposingTeam));
                        mod.EnableWorldIconText(opposingIcon, true);
                        mod.EnableWorldIconImage(opposingIcon, true);
                        this.baseIcons.set(opposingTeam, opposingIcon);
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
        if(this.baseIcons){
            for(let [targetTeamId, icon] of this.baseIcons.entries()){
                if(targetTeamId == this.teamId){
                    // Icon is for capture zone owner
                } else {
                    // Icon is for opposing team
                }
                mod.SetWorldIconText(icon, mod.Message(mod.stringkeys.capture_zone_label, GetTeamName(this.team)));
                mod.SetWorldIconImage(icon, mod.WorldIconImages.Flag);
                mod.SetWorldIconColor(icon, GetTeamColorById(this.teamId));
                mod.SetWorldIconPosition(icon, this.iconPosition);
            }
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
                mod.DisplayHighlightedWorldLogMessage(
                    mod.Message(mod.stringkeys.waiting_for_flag_return),
                    player
                );
                return;
            }
        
            // Team Score!
            ScoreCapture(player, flag, this.team);
        });

        
    }
}


//==============================================================================================
// FLAG CLASS
//==============================================================================================

class Flag {
    flagId: number;
    owningTeamId: number;
    allowedCapturingTeams: number[];
    customColor?: mod.Vector;
    
    // Legacy properties (kept for backwards compatibility during transition)
    team: mod.Team;
    teamId: number;
    homePosition: mod.Vector;
    currentPosition: mod.Vector;
    
    // State
    isAtHome: boolean = true;
    isBeingCarried: boolean = false;
    isDropped: boolean = false;
    canBePickedUp: boolean = true;
    
    // Player tracking
    carrierPlayer: mod.Player | null = null;
    
    // Timers
    dropTime: number = 0;
    canPickupTime: number = 0;
    autoReturnTime: number = 0;
    
    // Game objects
    // flagHomeWorldIcon: mod.WorldIcon;
    flagRecoverIcon: mod.WorldIcon;
    flagCarriedIcons: Map<number, mod.WorldIcon> = new Map(); // One icon per opposing team
    flagInteractionPoint: mod.InteractPoint | null = null;
    flagProp: mod.SpatialObject | null = null;
    flagHomeVFX: mod.VFX;
    carrierIcon: mod.WorldIcon | null = null;
    alarmSFX : mod.SFX | null = null;
    
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
        this.flagInteractionPoint = null;
        this.flagRecoverIcon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, ZERO_VEC, ZERO_VEC);
        this.flagProp = null;
        this.flagHomeVFX =  mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Smoke_Marker_Custom, this.homePosition, ZERO_VEC);       
        this.Initialize();
    }
    
    Initialize(): void {
        // Set up initial properties for capture icons
        mod.SetWorldIconOwner(this.flagRecoverIcon, this.team);

        // Create one carried icon per opposing team
        const opposingTeams = GetOpposingTeamsForFlag(this);
        for (const opposingTeamId of opposingTeams) {
            const opposingTeam = teams.get(opposingTeamId);
            if (opposingTeam) {
                const carriedIcon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, ZERO_VEC, ZERO_VEC);
                mod.SetWorldIconOwner(carriedIcon, opposingTeam);
                this.flagCarriedIcons.set(opposingTeamId, carriedIcon);
            }
        }

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
        
        // Enable flag VFX
        mod.SetVFXColor(this.flagHomeVFX, GetTeamColor(this.team));
        mod.EnableVFX(this.flagHomeVFX, true);
        mod.MoveVFX(this.flagHomeVFX, this.currentPosition, ZERO_VEC);

        this.flagProp = mod.SpawnObject(
            FLAG_PROP, 
            mod.Add(this.homePosition, flagOffset),
            ZERO_VEC
        );

        // Update defend icons for all opposing teams
        for (const [teamId, carriedIcon] of this.flagCarriedIcons.entries()) {
            mod.SetWorldIconColor(carriedIcon, GetTeamColor(this.team));
            mod.EnableWorldIconImage(carriedIcon, false);
            mod.SetWorldIconImage(carriedIcon, mod.WorldIconImages.Flag);
            mod.EnableWorldIconText(carriedIcon, false);
            mod.SetWorldIconText(carriedIcon, mod.Message(mod.stringkeys.defend_flag_label));
        }

        // Update recover icon
        mod.SetWorldIconColor(this.flagRecoverIcon, GetTeamColor(this.team));
        mod.EnableWorldIconImage(this.flagRecoverIcon, false);
        mod.EnableWorldIconText(this.flagRecoverIcon, false);
        mod.SetWorldIconImage(this.flagRecoverIcon, mod.WorldIconImages.Alert);
        mod.SetWorldIconText(this.flagRecoverIcon, mod.Message(mod.stringkeys.recover_flag_label));

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
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_already_holding_flag));
            return;
        }

        // Play sound effect to let team know the flag was taken
        if(this.isAtHome){
            this.PlayFlagAlarm().then(() => console.log("Flag alarm stopped"));
        }
        
        this.isAtHome = false;
        this.isBeingCarried = true;
        this.isDropped = false;
        this.carrierPlayer = player;

        // Remove flag prop
        if (this.flagProp) {
            mod.UnspawnObject(this.flagProp);
            this.flagProp = null;
        }

        // Flag carriers need updated weapons
        this.RestrictCarrierWeapons(player);
        
        // Show all carried icons for opposing teams
        for (const [teamId, carriedIcon] of this.flagCarriedIcons.entries()) {
            mod.EnableWorldIconImage(carriedIcon, true);
            mod.EnableWorldIconText(carriedIcon, true);
        }
        mod.EnableWorldIconImage(this.flagRecoverIcon, true);
        mod.EnableWorldIconText(this.flagRecoverIcon, true);

        // Set VFX properties
        mod.SetVFXColor(this.flagHomeVFX, GetTeamColor(this.team));
        
        // Notify all players
        const message = mod.Message(mod.stringkeys.team_flag_taken, GetTeamName(this.team));
        mod.DisplayHighlightedWorldLogMessage(message);

        // Remove roaming flag interaction point
        if(this.flagInteractionPoint){
            mod.UnspawnObject(this.flagInteractionPoint);
        }
        
        if (DEBUG_MODE) {
            const carrierTeam = mod.GetTeam(this.carrierPlayer);
            const carrierTeamId = mod.GetObjId(carrierTeam);
            console.log(`Flag picked up by player on team ${carrierTeamId}`);
        }
    }
    
    DropFlag(position?: mod.Vector): void {
        if (!this.isBeingCarried) return;

        this.isAtHome = false;
        this.isBeingCarried = false;
        this.isDropped = true;

        // Set flag drop point
        let dropPos: mod.Vector = position ? position : ZERO_VEC;
        if(!position && this.carrierPlayer){
            let soldierPos = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetPosition);
            dropPos = soldierPos;
        }
        this.currentPosition = dropPos;

        // Update the position of the flag interaction point
        this.UpdateFlagInteractionPoint();
        
        // Remove carrier restrictions
        if (this.carrierPlayer) {
            this.RestoreCarrierWeapons(this.carrierPlayer);
            mod.RemoveUIIcon(this.carrierPlayer);
        }
        this.carrierPlayer = null;
        
        // Spawn dropped flag prop
        if (this.flagProp) {
            mod.UnspawnObject(this.flagProp);
        }
        this.flagProp = mod.SpawnObject(
            FLAG_PROP,
            this.currentPosition,
            ZERO_VEC
        );
        
        // Start timers
        this.dropTime = GetCurrentTime();
        this.canPickupTime = this.dropTime + FLAG_PICKUP_DELAY;
        this.autoReturnTime = this.dropTime + FLAG_AUTO_RETURN_TIME;
        this.canBePickedUp = false;

        // Update capture icons for all opposing teams
        let flagIconOffset = mod.Add(this.currentPosition, mod.CreateVector(0,2,0));
        for (const [teamId, carriedIcon] of this.flagCarriedIcons.entries()) {
            mod.EnableWorldIconImage(carriedIcon, true);
            mod.EnableWorldIconText(carriedIcon, true);
            mod.SetWorldIconText(carriedIcon, mod.Message(mod.stringkeys.pickup_flag_label));
            mod.SetWorldIconPosition(carriedIcon, flagIconOffset);
        }
        mod.EnableWorldIconImage(this.flagRecoverIcon, true);
        mod.EnableWorldIconText(this.flagRecoverIcon, true);
        mod.SetWorldIconPosition(this.flagRecoverIcon, flagIconOffset);
        
        // Update VFX
        mod.MoveVFX(this.flagHomeVFX, this.currentPosition, ZERO_VEC);
        mod.SetVFXColor(this.flagHomeVFX, GetTeamDroppedColor(this.team));
        
        // Start pickup delay
        this.StartPickupDelay();

        // Play audio
        let friendlyVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
        if(friendlyVO){
            mod.PlayVO(friendlyVO, mod.VoiceOverEvents2D.ObjectiveContested, mod.VoiceOverFlags.Alpha, this.team);
        }
        
        if (DEBUG_MODE) {
            console.log(`Flag dropped`);
            mod.DisplayHighlightedWorldLogMessage(
                mod.Message(mod.stringkeys.flag_dropped, GetTeamName(this.team))
            );
        }
    }

    UpdateFlagInteractionPoint(){
        if(this.flagInteractionPoint && mod.GetObjId(this.flagInteractionPoint) > 1){
            mod.UnspawnObject(this.flagInteractionPoint);
        }

        let flagInteractOffset = mod.Add(this.currentPosition, mod.CreateVector(0, 1.3, 0));
        this.flagInteractionPoint = mod.SpawnObject(mod.RuntimeSpawn_Common.InteractPoint, flagInteractOffset, ZERO_VEC);
        if(this.flagInteractionPoint){
            mod.EnableInteractPoint(this.flagInteractionPoint, true);
        }
    }
    
    async StartPickupDelay(): Promise<void> {
        await mod.Wait(FLAG_PICKUP_DELAY);
        if (this.isDropped) {
            this.canBePickedUp = true;
            if (DEBUG_MODE) {
                // console.log("Flag can now be picked up");
                //mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_can_pickup));
            }
        }
    }
    
    ReturnToBase(): void {
        if (this.carrierPlayer) {
            this.RestoreCarrierWeapons(this.carrierPlayer);
            mod.RemoveUIIcon(this.carrierPlayer);
        }
        
        if (this.flagProp) {
            mod.UnspawnObject(this.flagProp);
            this.flagProp = null;
        }
        
        this.SpawnFlagAtHome();
        this.StopFlagAlarm();
        
        // Notify players
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.team_flag_returned, GetTeamName(this.team)));
        
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
            this.ReturnToBase();
        }
    }
    
    UpdateCarrier(): void {
        if (!this.isBeingCarried || !this.carrierPlayer) return;
        
        if (!mod.IsPlayerValid(this.carrierPlayer) || 
            !mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsAlive)) {
            return;
        }
        
        // Get the soldier position for attaching effects
        this.currentPosition = mod.GetSoldierState(
            this.carrierPlayer, 
            mod.SoldierStateVector.GetPosition
        );
        let currentRotation = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetFacingDirection);

        // Make smoke effect follow carrier
        mod.MoveVFX(this.flagHomeVFX, this.currentPosition, currentRotation);

        // Move flag icons for all opposing teams
        let flagIconOffset = mod.Add(this.currentPosition, mod.CreateVector(0,2.5,0));
        for (const [teamId, carriedIcon] of this.flagCarriedIcons.entries()) {
            mod.SetWorldIconPosition(carriedIcon, flagIconOffset);
        }
        mod.SetWorldIconPosition(this.flagRecoverIcon, flagIconOffset);

        // Force disable carrier weapons
        this.CheckCarrierDroppedFlag(this.carrierPlayer);
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
                    let soldierPos = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetPosition);
                    let facingDir = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetFacingDirection);
                    let flatFacingDir = mod.Normalize(mod.CreateVector(mod.XComponentOf(facingDir), 0, mod.ZComponentOf(facingDir)));
                    let localDropOffset = mod.Multiply(flatFacingDir, 2.5);
                    let dropPos = mod.Add(soldierPos, localDropOffset);
                    this.DropFlag(dropPos);
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
            mod.EnableSFX(this.alarmSFX, true);
            mod.PlaySound(this.alarmSFX, 100, this.currentPosition, 100);
        }

        // Play VO for flag owning team (defenders)
        let flagOwningTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
        if(flagOwningTeamVO){
            mod.PlayVO(flagOwningTeamVO, mod.VoiceOverEvents2D.ObjectiveLockdownEnemy, mod.VoiceOverFlags.Alpha, this.team);
        }
        
        // Play VO for all opposing teams (attackers)
        const opposingTeams = GetOpposingTeams(this.owningTeamId);
        for (const opposingTeamId of opposingTeams) {
            const opposingTeam = teams.get(opposingTeamId);
            if (opposingTeam) {
                let capturingTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
                if(capturingTeamVO){
                    mod.PlayVO(capturingTeamVO, mod.VoiceOverEvents2D.ObjectiveLockdownFriendly, mod.VoiceOverFlags.Alpha, opposingTeam);
                }
            }
        }
        
        // Stop flag sound after a duration
        await mod.Wait(FLAG_SFX_DURATION);
        this.StopFlagAlarm();
    }

    StopFlagAlarm(){
        if(this.alarmSFX){
            mod.StopSound(this.alarmSFX);
        }

        // Play VO for flag owning team
        let flagOwningTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
        if(flagOwningTeamVO){
            mod.PlayVO(flagOwningTeamVO, mod.VoiceOverEvents2D.ObjectiveNeutralised, mod.VoiceOverFlags.Alpha, this.team);
        }
        
        // Play VO for all opposing teams
        const opposingTeams = GetOpposingTeams(this.owningTeamId);
        for (const opposingTeamId of opposingTeams) {
            const opposingTeam = teams.get(opposingTeamId);
            if (opposingTeam) {
                let capturingTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
                if(capturingTeamVO){
                    mod.PlayVO(capturingTeamVO, mod.VoiceOverEvents2D.ObjectiveNeutralised, mod.VoiceOverFlags.Alpha, opposingTeam);
                }
            }
        }
    }
}

//==============================================================================================
// CONFIGURATION LOADING
//==============================================================================================

function CreateClassicCTFConfig(): GameModeConfig {
    // Default 2-team CTF configuration for backwards compatibility
    return {
        teams: [
            { 
                teamId: TeamID.TEAM_1, 
                name: mod.stringkeys.purple_team_name, 
                color: TEAM1_COLOR, 
                hqId: TEAM1_HQ_ID, 
                captureZones: [
                    {
                        team: team1
                    }
                ]
            },
            { 
                teamId: TeamID.TEAM_2, 
                name: mod.stringkeys.orange_team_name, 
                color: TEAM2_COLOR, 
                hqId: TEAM2_HQ_ID,
                captureZones: [
                    {
                        team: team2
                    }
                ]
            }
        ],
        flags: [
            {
                flagId: 1,
                owningTeamId: TeamID.TEAM_1,
                allowedCapturingTeams: [], // Empty = all opposing teams
                spawnObjectId: GetDefaultFlagSpawnIdForTeam(team1)
            },
            {
                flagId: 2,
                owningTeamId: TeamID.TEAM_2,
                allowedCapturingTeams: [], // Empty = all opposing teams
                spawnObjectId: GetDefaultFlagSpawnIdForTeam(team2)
            }
        ]
    };
}

function Create4TeamNeutralCTFConfig(): GameModeConfig {
    // 4 way CTF
    return {
        teams: [
            { 
                teamId: 1, 
                name: mod.stringkeys.purple_team_name, 
                color: TEAM1_COLOR, 
                hqId: TEAM1_HQ_ID,
                captureZones: [
                    {
                        team: team1
                    }
                ]
            },
            { 
                teamId: 2, 
                name: mod.stringkeys.orange_team_name, 
                color: TEAM2_COLOR, 
                hqId: TEAM2_HQ_ID,
                captureZones: [
                    {
                        team: team2
                    }
                ]
            },
            { teamId: 3, 
                name: mod.stringkeys.green_team_name, 
                color: TEAM3_COLOR, 
                hqId: TEAM3_HQ_ID,
                captureZones: [
                    {
                        team: team3
                    }
                ]
            },
            { 
                teamId: 4, 
                name: mod.stringkeys.blue_team_name, 
                color: TEAM4_COLOR, 
                hqId: TEAM4_HQ_ID,
                captureZones: [
                    {
                        team: team4
                    }
                ]
            }
        ],
        flags: [
            {
                flagId: 1,
                owningTeamId: TeamID.TEAM_1,
                allowedCapturingTeams: [], // Empty = all opposing teams
                spawnObjectId: GetDefaultFlagSpawnIdForTeam(team1)
            },
            {
                flagId: 2,
                owningTeamId: TeamID.TEAM_2,
                allowedCapturingTeams: [], // Empty = all opposing teams
                spawnObjectId: GetDefaultFlagSpawnIdForTeam(team2)
            },
            {
                flagId: 3,
                owningTeamId: TeamID.TEAM_3,
                allowedCapturingTeams: [], // Empty = all opposing teams
                spawnObjectId: GetDefaultFlagSpawnIdForTeam(team3)
            },
            {
                flagId: 4,
                owningTeamId: TeamID.TEAM_4,
                allowedCapturingTeams: [], // Empty = all opposing teams
                spawnObjectId: GetDefaultFlagSpawnIdForTeam(team4)
            }
            // {
            //     flagId: 5,
            //     owningTeamId: TeamID.TEAM_NEUTRAL,
            //     allowedCapturingTeams: [], // Empty = all opposing teams
            //     spawnObjectId: 104
            // }
        ]
    };
}


function LoadGameModeConfig(config: GameModeConfig): void {
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
                mod.Message(mod.stringkeys.scoreboard_team_label),
                mod.Message(mod.stringkeys.scoreboard_captures_label), 
                mod.Message(mod.stringkeys.scoreboard_capture_assists_label),
                mod.Message(mod.stringkeys.scoreboard_carrier_kills_label)
            );
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
    }

    // Initialize flags from config
    for (const flagConfig of config.flags) {
        const team = teams.get(flagConfig.owningTeamId);
        if (!team) {
            console.error(`Team ${flagConfig.owningTeamId} not found for flag ${flagConfig.flagId}`);
            continue;
        }
        
        // Get flag spawn position
        const flagSpawn = mod.GetSpatialObject(flagConfig.spawnObjectId);
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
// MAIN GAME LOOP
//==============================================================================================

export async function OnGameModeStarted() {
    console.log(`CTF Game Mode v${VERSION[0]}.${VERSION[1]}.${VERSION[2]} Started`);
    if(DEBUG_MODE)
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_version_started, VERSION[0], VERSION[1], VERSION[2]));

    // Initialize legacy team references (still needed for backwards compatibility)
    team1 = mod.GetTeam(1);
    team2 = mod.GetTeam(2);
    team3 = mod.GetTeam(3);
    team4 = mod.GetTeam(4);

    await mod.Wait(1);

    // Load game mode configuration
    const config = Create4TeamNeutralCTFConfig();//Create4TeamNeutralCTFConfig();
    LoadGameModeConfig(config);

    // Set up initial player scores using JSPlayer
    let players = mod.AllPlayers();
    let numPlayers = mod.CountOf(players);
    for (let i = 0; i < numPlayers; i++) {
        let loopPlayer = mod.ValueInArray(players, i);
        if(mod.IsPlayerValid(loopPlayer)){
            JSPlayer.get(loopPlayer); // Create JSPlayer instance
        }
    }

    // Enable HQs for configured teams
    for (const teamConfig of config.teams) {
        if (teamConfig.hqId) {
            mod.EnableHQ(mod.GetHQ(teamConfig.hqId), true);
        }
    }

    // Start game
    gameStarted = true;
    
    // Start update loops
    TickUpdate();
    SecondUpdate();
    
    console.log("CTF: Game initialized and started");
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_initialized));

    RefreshScoreboard();
}

function RefreshScoreboard(){
    for(let jsPlayer of JSPlayer.getAllAsArray()){
        UpdatePlayerScoreboard(jsPlayer.player);
    }
}

async function TickUpdate(): Promise<void> {
    const tickRate = 0.016; // ~60fps
    
    while (gameStarted) {
        await mod.Wait(tickRate);
        
        // Update all flag carrier positions
        for (const [flagId, flagData] of flags.entries()) {
            if (flagData.isBeingCarried) {
                flagData.UpdateCarrier();
            }
        }
    }
}

async function SecondUpdate(): Promise<void> {
    while (gameStarted) {
        await mod.Wait(1);
        
        // Check auto-return timers for all flags
        for (const [flagId, flagData] of flags.entries()) {
            flagData.CheckAutoReturn();
        }
        
        // Periodic team balance check
        if (AUTO_TEAM_BALANCE) {
            CheckAndBalanceTeams();
        }
        
        // Check time limit
        if (mod.GetMatchTimeRemaining() <= 0) {
            EndGameByTime();
        }
    }
}

//==============================================================================================
// EVENT HANDLERS
//==============================================================================================

export function OnPlayerJoinGame(eventPlayer: mod.Player): void {
    if (DEBUG_MODE) {
        console.log(`Player joined: ${mod.GetObjId(eventPlayer)}`);
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_joined, mod.GetObjId(eventPlayer)));
    }
    // Trigger team balance check
    CheckAndBalanceTeams();

    // Refresh scoreboard to update new player team entry and score
    RefreshScoreboard();
}

export function OnPlayerLeaveGame(playerId: number): void {
    // Check if leaving player was carrying any flag
    for (const [flagId, flagData] of flags.entries()) {
        if (flagData.carrierPlayer && mod.GetObjId(flagData.carrierPlayer) === playerId) {
            flagData.DropFlag();
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
}

export function OnPlayerDied(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDeathType: mod.DeathType,
    eventWeaponUnlock: mod.WeaponUnlock
): void {
    // If player was carrying a flag, drop it
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_died, eventPlayer));
    
        // Increment flag carrier kill score
    let killer = JSPlayer.get(eventOtherPlayer);
    if(killer && IsCarryingAnyFlag(eventPlayer))
        killer.score.flag_carrier_kills += 1;

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
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.debug_player_enter_vehicle));

    // Check if player is carrying a flag
    if (IsCarryingAnyFlag(eventPlayer)) {
        if (DEBUG_MODE) {
            console.log("Flag carrier entered vehicle");
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.carrier_enter_vehicle));
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
    if (IsCarryingAnyFlag(eventPlayer)) {      
        if (mod.GetPlayerVehicleSeat(eventPlayer) === 0) { // Driver seat
            if (DEBUG_MODE) console.log("Flag carrier in driver seat, forcing to passenger");
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.forced_to_seat))
            ForceToPassengerSeat(eventPlayer, eventVehicle);
        }
    }
}

export function OnGameModeEnding(): void {
    gameStarted = false;
    console.log("CTF: Game ending");
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_ending))
}

//==============================================================================================
// GAME LOGIC FUNCTIONS
//==============================================================================================

function HandleFlagInteraction(
    player: mod.Player, 
    playerTeamId: number, 
    flagData: Flag
): void {
    
    if (DEBUG_MODE) {
        // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.red_flag_position, mod.XComponentOf(flagData.homePosition), mod.YComponentOf(flagData.homePosition), mod.ZComponentOf(flagData.homePosition)));
    }

    // Enemy team trying to take flag
    if (playerTeamId !== flagData.teamId) {
        if (flagData.isAtHome || (flagData.isDropped && flagData.canBePickedUp)) {
            flagData.PickupFlag(player);
        } else if (flagData.isDropped && !flagData.canBePickedUp) {
            if(DEBUG_MODE){
                mod.DisplayHighlightedWorldLogMessage(
                    mod.Message(mod.stringkeys.waiting_to_take_flag),
                    player
                );
            }
        }
    }
    // Own team trying to return dropped flag
    else if (playerTeamId === flagData.teamId && flagData.isDropped) {
        flagData.ReturnToBase();
    }
}

function UpdatePlayerScoreboard(player: mod.Player){
    let jsPlayer = JSPlayer.get(player);
    let teamId = modlib.getTeamId(mod.GetTeam(player));
    if(jsPlayer){
        if(teams.size >= 2){
            mod.SetScoreboardPlayerValues(player, teamId, jsPlayer.score.captures, jsPlayer.score.capture_assists, jsPlayer.score.flag_carrier_kills);
        } else {
            mod.SetScoreboardPlayerValues(player, jsPlayer.score.captures, jsPlayer.score.capture_assists, jsPlayer.score.flag_carrier_kills);
        }
    }
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
        CaptureFeedback(scoringTeamFlag.homePosition);
        
        // Play audio
        let capturingTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, scoringTeamFlag.homePosition, ZERO_VEC);
        if(capturingTeamVO){
            mod.PlayVO(capturingTeamVO, mod.VoiceOverEvents2D.ObjectiveCapturedGeneric, mod.VoiceOverFlags.Alpha, scoringTeam);
        }
    }

    // Return all flags to base
    for (const [flagId, flagData] of flags.entries()) {
        flagData.ReturnToBase();
    }
    
    // Check win condition
    if (currentScore >= TARGET_SCORE) {
        EndGameByScore(scoringTeamId);
    }
}

function ForceToPassengerSeat(player: mod.Player, vehicle: mod.Vehicle): void {
    const seatCount = mod.GetVehicleSeatCount(vehicle);
    
    // Try to find an empty passenger seat
    for (let i = seatCount-1; i >= 1; --i) {
        if (!mod.IsVehicleSeatOccupied(vehicle, i)) {
            mod.ForcePlayerToSeat(player, vehicle, i);
            if (DEBUG_MODE) console.log(`Forced flag carrier to seat ${i}`);
            return;
        }
    }
    
    // No passenger seats available, force exit
    mod.ForcePlayerExitVehicle(player, vehicle);
    if (DEBUG_MODE) console.log("No passenger seats available, forcing exit");
}

function EndGameByScore(winningTeamId: number): void {
    gameStarted = false;
    
    const winningTeam = mod.GetTeam(winningTeamId);
    const teamName = winningTeamId === 1 ? "Blue" : "Red";
    
    console.log(`Game ended - Team ${winningTeamId} wins by score`);
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.game_ended_score, winningTeamId))
    mod.EndGameMode(winningTeam);    
}

function EndGameByTime(): void {
    gameStarted = false;
    // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.game_ended_time));
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

//==============================================================================================
// TEAM BALANCE FUNCTIONS
//==============================================================================================

async function CheckAndBalanceTeams(): Promise<void> {
    if (!AUTO_TEAM_BALANCE || balanceInProgress || !gameStarted) return;
    
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
    
    // Notify players
    mod.DisplayHighlightedWorldLogMessage(
        mod.Message("Teams will automatically balance in 5 seconds")
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

//==============================================================================================
// UTILITY FUNCTIONS
//==============================================================================================

function GetCurrentTime(): number {
    return mod.GetMatchTimeElapsed();
}

function GetRandomInt(max: number): number {
    return Math.floor(Math.random() * max);
}

function VectorToString(v: mod.Vector): string {
    return `X: ${mod.XComponentOf(v)}, Y: ${mod.YComponentOf(v)}, Z: ${mod.ZComponentOf(v)}`
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

function GetOpposingTeamsForFlag(flagData: Flag): number[] {
    // If flag has specific allowed capturing teams, return those
    if (flagData.allowedCapturingTeams.length > 0) {
        return flagData.allowedCapturingTeams;
    }
    
    // Otherwise return all teams except the flag owner
    return GetOpposingTeams(flagData.owningTeamId);
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

function IsCarryingAnyFlag(player: mod.Player): boolean {
    // Check all flags dynamically
    for (const [flagId, flagData] of flags.entries()) {
        if (flagData.carrierPlayer && mod.Equals(flagData.carrierPlayer, player)) {
            return true;
        }
    }
    return false;
}

function DropAllFlags(player: mod.Player){
    let playerPos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
    let playerPosX = mod.XComponentOf(playerPos);
    let playerPosY = mod.YComponentOf(playerPos);
    let playerPosZ = mod.ZComponentOf(playerPos);
    let flagDropRadius = 2.5;

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


// Godot flag IDs
// --------------

function GetFlagTeamIdOffset(team: mod.Team): number {
    let teamID = mod.GetObjId(team);
    return TEAM_ID_START_OFFSET + (teamID * TEAM_ID_STRIDE_OFFSET);
}

function GetDefaultFlagCaptureZoneAreaTriggerIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_CAPTURE_ZONE_ID_OFFSET;
}

function GetDefaultFlagSpawnIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_SPAWN_ID_OFFSET;
}

function GetDefaultFlagCaptureZoneSpatialIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_CAPTURE_ZONE_ICON_ID_OFFSET;
}

function CaptureFeedback(pos: mod.Vector): void {
    let vfx: mod.VFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_BASE_Sparks_Pulse_L, pos, ZERO_VEC);
    mod.EnableVFX(vfx, true);
    let sfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_OnCapturedByFriendly_OneShot2D, pos, ZERO_VEC);
    mod.EnableSFX(sfx, true);
    mod.PlaySound(sfx, 100);
}

// Helper function to parse JSON from in strings.json
// Data in strings.json should look similar to "data": "{ \"test\": 20,\"notTest\": 30 }"
function getStringValue(stringKey: string): any {
    // @ts-ignore
    const obj = mod?.strings;
    return obj?.[stringKey];
}

function NormalizeColour(r:number, g:number, b:number): [number, number, number] {
    return [r/255.0, g/255.0, b/255.0]
}
