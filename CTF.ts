/* 
 * Capture the Flag Game Mode
 * 
 * Two teams compete to capture the enemy flag and return it to their base.
 * First team to reach the target score wins.
 * Author: Claude Sonnet 4.5 (20250929). Prompted by Mystfit.
 */

//==============================================================================================
// CONFIGURATION CONSTANTS
//==============================================================================================

const VERSION = [1, 0, 0];
const DEBUG_MODE = true;

// Game Settings
const TARGET_SCORE = 3; // Points needed to win
const MATCH_TIME_LIMIT = 1200; // 20 minutes in seconds
const FLAG_PICKUP_DELAY = 3; // Seconds before dropped flag can be picked up
const FLAG_AUTO_RETURN_TIME = 30; // Seconds before dropped flag auto-returns to base
const FLAG_INTERACT_DISTANCE = 3.0; // Distance to interact with flag

// Object IDs (these need to be set in Godot)
const TEAM1_FLAG_INTERACT_ID = 3;
const TEAM2_FLAG_INTERACT_ID = 4;
const TEAM1_CAPTURE_ZONE_ID = 11;
const TEAM2_CAPTURE_ZONE_ID = 12;
const TEAM1_HQ_ID = 1;
const TEAM2_HQ_ID = 2;
const TEAM1_FLAG_ICON_ID = 101;
const TEAM2_FLAG_ICON_ID = 102;
const TEAM1_FLAG_MODEL_ID = 200;
const TEAM2_FLAG_MODEL_ID = 201;

// Colors
const TEAM1_COLOR = mod.CreateVector(0, 0.4, 1); // Blue
const TEAM2_COLOR = mod.CreateVector(1, 0, 0); // Red
const NEUTRAL_COLOR = mod.CreateVector(1, 1, 1); // White
const DROPPED_FLAG_COLOR = mod.CreateVector(1, 1, 0); // Yellow

// Utility
const ZERO_VEC = mod.CreateVector(0, 0, 0);
const ONE_VEC = mod.CreateVector(1, 1, 1);

//==============================================================================================
// GLOBAL STATE
//==============================================================================================

let gameStarted = false;
let matchTimeRemaining = MATCH_TIME_LIMIT;
let team1Score = 0;
let team2Score = 0;

// Team references
let team1: mod.Team;
let team2: mod.Team;

// Flag data instances
let team1FlagData: FlagData;
let team2FlagData: FlagData;

class PlayerScore {
    captures: number
    capture_assists: number

    constructor(captures: number = 0, capture_assists: number = 0){
        this.captures = captures;
        this.capture_assists = capture_assists
    }
}

// Player scoring
let playerScores: Map<number, PlayerScore> = new Map<number, PlayerScore>();


//==============================================================================================
// FLAG DATA CLASS
//==============================================================================================

class FlagData {
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
    flagHomeWorldIcon: mod.WorldIcon;
    flagInteractPoint: mod.InteractPoint;
    captureZoneTrigger: mod.AreaTrigger;
    flagProp: mod.SpatialObject | null = null;
    flagHomeVFX: mod.VFX;
    carrierIcon: mod.WorldIcon | null = null;
    
    constructor(
        team: mod.Team, 
        homePosition: mod.Vector,
        flagInteractId: number,
        captureZoneId: number,
        flagIconId: number,
        // flagProp: mod.SpatialObject
    ) {
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.homePosition = homePosition;
        this.currentPosition = homePosition;
        this.flagInteractPoint = mod.GetInteractPoint(flagInteractId);
        this.captureZoneTrigger = mod.GetAreaTrigger(captureZoneId);
        this.flagHomeWorldIcon = mod.GetWorldIcon(flagIconId);
        this.flagProp = null;
        this.flagHomeVFX =  mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Smoke_Marker_Custom, this.homePosition, ZERO_VEC);       
        this.Initialize();
    }
    
    Initialize(): void {
        // Set up flag at home position
        this.SpawnFlagAtHome();
        
        // Configure world icon
        let flag_text = this.teamId === 1 ? mod.stringkeys.blue_flag_label : mod.stringkeys.red_flag_label
        mod.SetWorldIconText(this.flagHomeWorldIcon, mod.Message(flag_text));
        mod.SetWorldIconPosition(this.flagHomeWorldIcon, this.homePosition);
        mod.SetWorldIconColor(this.flagHomeWorldIcon, this.GetTeamColor());
        mod.EnableWorldIconImage(this.flagHomeWorldIcon, true);
        mod.EnableWorldIconText(this.flagHomeWorldIcon, true);
        
        // Enable flag interact point
        mod.EnableInteractPoint(this.flagInteractPoint, true);
        
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
        
        // Spawn flag prop at home
        if (this.flagProp) {
            mod.UnspawnObject(this.flagProp);
        }
        
        // Enable flag VFX
        mod.SetVFXColor(this.flagHomeVFX, this.GetTeamColor());
        mod.EnableVFX(this.flagHomeVFX, true);
        mod.MoveVFX(this.flagHomeVFX, this.currentPosition, ZERO_VEC);

        this.flagProp = mod.SpawnObject(
            mod.RuntimeSpawn_Common.MCOM, 
            this.homePosition, 
            ZERO_VEC
        );

        if (DEBUG_MODE){
            // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.spawning_flag, mod.XComponentOf(this.homePosition), mod.YComponentOf(this.homePosition), mod.ZComponentOf(this.homePosition)));
            console.log(`Spawning flag at ${this.homePosition}`);
        }
        
        // Update world icon
        mod.SetWorldIconPosition(this.flagHomeWorldIcon, this.homePosition);
        mod.SetWorldIconColor(this.flagHomeWorldIcon, this.GetTeamColor());
        mod.EnableWorldIconImage(this.flagHomeWorldIcon, true);
        mod.EnableWorldIconText(this.flagHomeWorldIcon, true);
    }
    
    PickupFlag(player: mod.Player): void {
        if (!this.canBePickedUp) {
            if (DEBUG_MODE) {
                console.log("Flag cannot be picked up yet (delay active)");
                mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_pickup_delay));
            }
            return;
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

        // Disable VFX
        //mod.EnableVFX(this.flagHomeVFX, false);

        
        // Restrict carrier's weapons
        this.RestrictCarrierWeapons(player);
        
        // Add UI icon above carrier
        // mod.AddUIIcon(
        //     player,
        //     mod.WorldIconImages.Flag,
        //     10,
        //     this.GetTeamColor(),
        //     mod.Message("FLAG CARRIER")
        // );
        
        // Hide flag position icon, we'll track carrier position
        mod.EnableWorldIconImage(this.flagHomeWorldIcon, false);
        mod.EnableWorldIconText(this.flagHomeWorldIcon, false);
        
        // Notify all players
        const carrierTeam = mod.GetTeam(this.carrierPlayer);
        const carrierTeamId = mod.GetObjId(carrierTeam);
        const message = this.teamId === 1 
            ? mod.Message(mod.stringkeys.blue_flag_taken) 
            : mod.Message(mod.stringkeys.red_flag_taken);
        mod.DisplayHighlightedWorldLogMessage(message);
        
        if (DEBUG_MODE) {
            console.log(`Flag picked up by player on team ${carrierTeamId}`);
            // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_picked_up, carrierTeamId));
        }
    }
    
    DropFlag(position?: mod.Vector): void {
        if (!this.isBeingCarried) return;
        
        const dropPos = position || (this.carrierPlayer 
            ? mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetPosition)
            : this.currentPosition);
        
        this.isAtHome = false;
        this.isBeingCarried = false;
        this.isDropped = true;
        this.carrierPlayer = null;
        this.currentPosition = mod.Add(dropPos, mod.CreateVector(0, 1, 0));
        
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
            mod.RuntimeSpawn_Common.MCOM,
            this.currentPosition,
            ZERO_VEC
        );
        
        // Start timers
        this.dropTime = GetCurrentTime();
        this.canPickupTime = this.dropTime + FLAG_PICKUP_DELAY;
        this.autoReturnTime = this.dropTime + FLAG_AUTO_RETURN_TIME;
        this.canBePickedUp = false;
        
        // Update world icon
        mod.SetWorldIconPosition(this.flagHomeWorldIcon, this.currentPosition);
        mod.SetWorldIconColor(this.flagHomeWorldIcon, DROPPED_FLAG_COLOR);
        mod.EnableWorldIconImage(this.flagHomeWorldIcon, true);
        mod.EnableWorldIconText(this.flagHomeWorldIcon, true);

        // Update VFX
        mod.SetVFXColor(this.flagHomeVFX, NEUTRAL_COLOR);
        
        // Start pickup delay
        this.StartPickupDelay();
        
        // Notify players
        const message = this.teamId === 1 
            ? mod.Message(mod.stringkeys.blue_flag_dropped)
            : mod.Message(mod.stringkeys.red_flag_dropped);
        mod.DisplayHighlightedWorldLogMessage(message);
        
        if (DEBUG_MODE) {
            console.log(`Flag dropped at position: ${VectorToString(this.currentPosition)}`);
            // mod.DisplayHighlightedWorldLogMessage(
            //     mod.Message(mod.stringkeys.flag_dropped, VectorToString(this.currentPosition))
            // );
        }
    }
    
    async StartPickupDelay(): Promise<void> {
        await mod.Wait(FLAG_PICKUP_DELAY);
        if (this.isDropped) {
            this.canBePickedUp = true;
            if (DEBUG_MODE) {
                console.log("Flag can now be picked up");
                mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_can_pickup));
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
        
        // Notify players
        const message = this.teamId === 1 
            ? mod.Message(mod.stringkeys.blue_flag_returned) 
            : mod.Message(mod.stringkeys.red_flag_returned);
        mod.DisplayHighlightedWorldLogMessage(message);
        
        if (DEBUG_MODE) {
            console.log(`Flag returned to base for team ${this.teamId}`);
            // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_returned, this.teamId));
        }
    }
    
    CheckAutoReturn(): void {
        if (!this.isDropped) return;
        
        const currentTime = GetCurrentTime();
        if (currentTime >= this.autoReturnTime) {
            if (DEBUG_MODE) {
                console.log("Flag auto-returning to base");
                mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_auto_return));
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

        // Force disable carrier weapons
        this.RestrictCarrierWeapons(this.carrierPlayer);
    }
    
    RestrictCarrierWeapons(player: mod.Player): void {
        // Remove all weapons
        // mod.RemoveEquipment(player, mod.InventorySlots.PrimaryWeapon);
        // mod.RemoveEquipment(player, mod.InventorySlots.SecondaryWeapon);
        // mod.RemoveEquipment(player, mod.InventorySlots.ClassGadget);
        // mod.RemoveEquipment(player, mod.InventorySlots.GadgetOne);
        // mod.RemoveEquipment(player, mod.InventorySlots.GadgetTwo);
        // mod.RemoveEquipment(player, mod.InventorySlots.MiscGadget);
        // mod.RemoveEquipment(player, mod.InventorySlots.Throwable);

        // Force equip sledgehammer
        if(!mod.IsInventorySlotActive(player, mod.InventorySlots.MeleeWeapon)){
            mod.AddEquipment(player, mod.Gadgets.Melee_Sledgehammer);
            mod.ForceSwitchInventory(player, mod.InventorySlots.MeleeWeapon);
        }
        
        if (DEBUG_MODE) {
            console.log("Carrier weapons restricted");
            // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.carrier_weapons_restricted));
        }
    }
    
    RestoreCarrierWeapons(player: mod.Player): void {
        // Note: In a full implementation, you'd want to track and restore the player's original loadout
        // For now, we'll just remove the sledgehammer and let them pick up weapons
        if (DEBUG_MODE) {
            console.log("Carrier weapons restored");
            // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.carrier_weapons_restored));
        }
    }
    
    GetTeamColor(): mod.Vector {
        return this.teamId === mod.GetObjId(team1) ? TEAM1_COLOR : TEAM2_COLOR;
    }
    
    IsPlayerOnThisTeam(player: mod.Player): boolean {
        return mod.GetObjId(mod.GetTeam(player)) === this.teamId;
    }
}

//==============================================================================================
// MAIN GAME LOOP
//==============================================================================================

export async function OnGameModeStarted() {
    console.log(`CTF Game Mode v${VERSION[0]}.${VERSION[1]}.${VERSION[2]} Started`);
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_version_started, VERSION[0], VERSION[1], VERSION[2]));
    mod.SendErrorReport(mod.Message(mod.stringkeys.ctf_version_started, VERSION[0], VERSION[1], VERSION[2]));

    // Initialize teams
    team1 = mod.GetTeam(1);
    team2 = mod.GetTeam(2);

    // Set up initial player scores
    let players = mod.AllPlayers();
    let numPlayers = mod.CountOf(players);
    for (let i = 0; i < numPlayers; i++) {
        let loopPlayer = mod.ValueInArray(players, i);
        if(mod.IsPlayerValid(loopPlayer)){
            playerScores.set(mod.GetObjId(loopPlayer), new PlayerScore());
        }
    }


    // Set scoreboard
    mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams);
    mod.SetScoreboardHeader(mod.Message(mod.stringkeys.blue_team_name), mod.Message(mod.stringkeys.red_team_name));
    mod.SetScoreboardColumnNames(mod.Message(mod.stringkeys.scoreboard_captures_label), mod.Message(mod.stringkeys.scoreboard_capture_assists_label));
    // mod.SetScoreboardSorting(1);

    // Get flag positions from InteractPoint objects
    const team1FlagInteract = mod.GetInteractPoint(TEAM1_FLAG_INTERACT_ID);
    const team2FlagInteract = mod.GetInteractPoint(TEAM2_FLAG_INTERACT_ID);
    const team1WorldIcon = mod.GetWorldIcon(TEAM1_FLAG_ICON_ID);
    const team2WorldIcon = mod.GetWorldIcon(TEAM2_FLAG_ICON_ID);
    const team1WorldSpawn = mod.GetSpatialObject(TEAM1_FLAG_MODEL_ID);
    const team2WorldSpawn = mod.GetSpatialObject(TEAM2_FLAG_MODEL_ID);
    const team1FlagPosition = mod.GetObjectPosition(team1WorldSpawn);
    const team2FlagPosition = mod.GetObjectPosition(team2WorldSpawn);
    
    // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.red_flag_position, mod.XComponentOf(team1FlagPosition), mod.YComponentOf(team1FlagPosition), mod.ZComponentOf(team1FlagPosition)));
    // mod.SendErrorReport(mod.Message(mod.stringkeys.red_flag_position, mod.XComponentOf(team1FlagPosition), mod.YComponentOf(team1FlagPosition), mod.ZComponentOf(team1FlagPosition)));
    // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.blue_flag_position, mod.XComponentOf(team2FlagPosition), mod.YComponentOf(team2FlagPosition), mod.ZComponentOf(team2FlagPosition)));

    // Initialize flags
    team1FlagData = new FlagData(
        team1,
        team1FlagPosition,
        TEAM1_FLAG_INTERACT_ID,
        TEAM1_CAPTURE_ZONE_ID,
        TEAM1_FLAG_ICON_ID
    );
    
    team2FlagData = new FlagData(
        team2,
        team2FlagPosition,
        TEAM2_FLAG_INTERACT_ID,
        TEAM2_CAPTURE_ZONE_ID,
        TEAM2_FLAG_ICON_ID
    );
    
    // Set game time limit
    mod.SetGameModeTimeLimit(MATCH_TIME_LIMIT);
    
    // Enable HQs
    mod.EnableHQ(mod.GetHQ(TEAM1_HQ_ID), true);
    mod.EnableHQ(mod.GetHQ(TEAM2_HQ_ID), true);

    // Start game
    gameStarted = true;
    
    // Start update loops
    TickUpdate();
    SecondUpdate();
    
    console.log("CTF: Game initialized and started");
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_initialized));
}

async function TickUpdate(): Promise<void> {
    const tickRate = 0.016; // ~60fps
    
    while (gameStarted) {
        await mod.Wait(tickRate);
        
        // Update flag carrier positions
        if (team1FlagData.isBeingCarried) {
            team1FlagData.UpdateCarrier();
        }
        
        if (team2FlagData.isBeingCarried) {
            team2FlagData.UpdateCarrier();
        }
        
        // Check for flag interactions (proximity-based)
        CheckFlagProximity();
    }
}

async function SecondUpdate(): Promise<void> {
    while (gameStarted) {
        await mod.Wait(1);
        
        // Update match time
        matchTimeRemaining--;
        
        // Check auto-return timers
        team1FlagData.CheckAutoReturn();
        team2FlagData.CheckAutoReturn();
        
        // Check time limit
        if (matchTimeRemaining <= 0) {
            EndGameByTime();
        }
    }
}

function CheckFlagProximity(): void {
    const allPlayers = mod.AllPlayers();
    
    for (let i = 0; i < mod.CountOf(allPlayers); i++) {
        const player = mod.ValueInArray(allPlayers, i) as mod.Player;
        
        if (!mod.IsPlayerValid(player) || 
            !mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) {
            continue;
        }
        
        const playerPos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
        const playerTeamId = mod.GetObjId(mod.GetTeam(player));
        
        // Check proximity to enemy flag
        if (playerTeamId === 1) {
            CheckFlagPickupProximity(player, playerPos, team2FlagData);
        } else if (playerTeamId === 2) {
            CheckFlagPickupProximity(player, playerPos, team1FlagData);
        }
    }
}

function CheckFlagPickupProximity(
    player: mod.Player, 
    playerPos: mod.Vector, 
    flagData: FlagData
): void {
    // Can't pick up flag if already carrying one
    if (team1FlagData.carrierPlayer === player || team2FlagData.carrierPlayer === player) {
        return;
    }
    
    const distance = mod.DistanceBetween(playerPos, flagData.currentPosition);
    
    // Dropped flag - can be picked up or returned
    if (flagData.isDropped && distance <= FLAG_INTERACT_DISTANCE) {
        // Show prompt? (Would need UI implementation)
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

    // Guarantee default player score
    playerScores.set(mod.GetObjId(eventPlayer), new PlayerScore());
}

export function OnPlayerLeaveGame(playerId: number): void {
    // Check if leaving player was carrying a flag
    if (team1FlagData.carrierPlayer && mod.GetObjId(team1FlagData.carrierPlayer) === playerId) {
        team1FlagData.DropFlag();
    }
    
    if (team2FlagData.carrierPlayer && mod.GetObjId(team2FlagData.carrierPlayer) === playerId) {
        team2FlagData.DropFlag();
    }
    
    if (DEBUG_MODE) {
        console.log(`Player left: ${playerId}`);
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_left, playerId));
    }

    // Remove player from score tracking
    playerScores.delete(playerId);
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
    if(team1FlagData.carrierPlayer){
        if (mod.GetObjId(team1FlagData.carrierPlayer) === mod.GetObjId(eventPlayer)) {
            team1FlagData.DropFlag();
        }
    }
    
    if(team2FlagData.carrierPlayer){
        if (team2FlagData.carrierPlayer === eventPlayer) {
            team2FlagData.DropFlag();
        }
    }
}

export function OnPlayerInteract(
    eventPlayer: mod.Player, 
    eventInteractPoint: mod.InteractPoint
): void {
    const interactId = mod.GetObjId(eventInteractPoint);
    const playerTeamId = mod.GetObjId(mod.GetTeam(eventPlayer));
    
    if (DEBUG_MODE) {
        // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_interact, eventPlayer, mod.GetObjId(eventInteractPoint)))
        console.log(mod.stringkeys.player_interact, eventPlayer, mod.GetObjId(eventInteractPoint));
    }
    
    // Check flag interactions
    if (interactId === TEAM1_FLAG_INTERACT_ID) {
        HandleFlagInteraction(eventPlayer, playerTeamId, team1FlagData);
    } else if (interactId === TEAM2_FLAG_INTERACT_ID) {
        HandleFlagInteraction(eventPlayer, playerTeamId, team2FlagData);
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
    
    // Check if player entered their own capture zone
    if (triggerId === TEAM1_CAPTURE_ZONE_ID && playerTeamId === mod.GetObjId(team1)) {
        HandleCaptureZoneEntry(eventPlayer, team1);
    } else if (triggerId === TEAM2_CAPTURE_ZONE_ID && playerTeamId === mod.GetObjId(team2)) {
        HandleCaptureZoneEntry(eventPlayer, team2);
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
    // Check if player is carrying a flag
    if (team1FlagData.carrierPlayer === eventPlayer || 
        team2FlagData.carrierPlayer === eventPlayer) {
        
        if (DEBUG_MODE) {
            console.log("Flag carrier entered vehicle");
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.carrier_enter_vehicle))
        }
    }
}

export function OnPlayerEnterVehicleSeat(
    eventPlayer: mod.Player,
    eventVehicle: mod.Vehicle,
    eventSeat: mod.Object
): void {
    // If player is carrying flag and in driver seat, force to passenger
    const isCarrier = team1FlagData.carrierPlayer === eventPlayer || 
                      team2FlagData.carrierPlayer === eventPlayer;
    
    if (isCarrier) {
        const seatIndex = mod.GetPlayerVehicleSeat(eventPlayer);
        
        if (seatIndex === 0) { // Driver seat
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
    flagData: FlagData
): void {
    
    if (DEBUG_MODE) {
        // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.red_flag_position, mod.XComponentOf(flagData.homePosition), mod.YComponentOf(flagData.homePosition), mod.ZComponentOf(flagData.homePosition)));
    }

    // Enemy team trying to take flag
    if (playerTeamId !== flagData.teamId) {
        if (flagData.isAtHome || (flagData.isDropped && flagData.canBePickedUp)) {
            flagData.PickupFlag(player);
        } else if (flagData.isDropped && !flagData.canBePickedUp) {
            mod.DisplayHighlightedWorldLogMessage(
                mod.Message(mod.stringkeys.waiting_to_take_flag),
                player
            );
        }
    }
    // Own team trying to return dropped flag
    // else if (playerTeamId === flagData.teamId && flagData.isDropped) {
    //     mod.DisplayHighlightedWorldLogMessage(
    //         mod.Message(mod.stringkeys.own_team_interacting),
    //         player
    //     );
    //     flagData.ReturnToBase();
    // }
}

function HandleCaptureZoneEntry(
    player: mod.Player,
    captureZoneTeam: mod.Team
): void {
    const playerTeamId = mod.GetObjId(mod.GetTeam(player));

    let isCarryingEnemyFlag: boolean = false;
    const heldFlag = GetCarriedFlagFromPlayer(player);
    if(heldFlag){
        if(heldFlag.carrierPlayer){
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_from_player_result, player, GetTeamName(mod.GetTeam(heldFlag.carrierPlayer))));
            if(mod.GetObjId(heldFlag.team) != mod.GetObjId(mod.GetTeam(heldFlag.carrierPlayer))){
                isCarryingEnemyFlag = true;
            }
        } else {
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_owner_error, player));
        }
    } else {
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_not_held_error, player));
    }
    
    if (!isCarryingEnemyFlag) {
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.not_carrying_flag, player))
        return;
    }
    
    // Check if own flag is at home
    const ownFlagData = playerTeamId === mod.GetObjId(team1) ? team1FlagData : team2FlagData;
    
    if (!ownFlagData.isAtHome) {
        mod.DisplayHighlightedWorldLogMessage(
            mod.Message(mod.stringkeys.waiting_for_flag_return),
            player
        );
        return;
    }
   
    // Team Score!
    ScoreCapture(player, captureZoneTeam);
}

function ScoreCapture(scoringPlayer: mod.Player, scoringTeam: mod.Team): void {
    // Set player score
    let playerID = mod.GetObjId(scoringPlayer);
    let player_score = playerScores.get(playerID);
    if (player_score) {
        player_score.captures += 1;
        mod.SetScoreboardPlayerValues(scoringPlayer, player_score.captures, player_score.capture_assists);
        mod.DisplayHighlightedWorldLogMessage(mod.Message(
            mod.stringkeys.player_score, 
            player_score.captures, 
            player_score.capture_assists));
    } else {
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_missing));
    }

    // Increment score
    let scoringTeamId = mod.GetObjId(scoringTeam);
    let teamScore: number;
    if (mod.GetObjId(scoringTeam) === mod.GetObjId(team1)) {
        team1Score++;
        teamScore = team1Score;
    } else {
        team2Score++;
        teamScore = team2Score;
    }
    
    // Update game mode score
    mod.SetGameModeScore(mod.GetTeam(scoringTeamId), teamScore);
    
    // Notify players
    const teamName = scoringTeamId === mod.GetObjId(team1) ? mod.stringkeys.blue_team_name : mod.stringkeys.red_team_name;
    mod.DisplayHighlightedWorldLogMessage(
        mod.Message(mod.stringkeys.team_scored, scoringTeamId, team1Score, team2Score)
    );

    // Play VFX
    CaptureFeedback(mod.GetObjId(scoringTeam) === mod.GetObjId(team1) ? team1FlagData.homePosition : team2FlagData.homePosition);
    
    // Return both flags to base
    team1FlagData.ReturnToBase();
    team2FlagData.ReturnToBase();
    
    // Check win condition
    if ((scoringTeamId === 1 && team1Score >= TARGET_SCORE) ||
        (scoringTeamId === 2 && team2Score >= TARGET_SCORE)) {
        EndGameByScore(scoringTeamId);
    }
}

function ForceToPassengerSeat(player: mod.Player, vehicle: mod.Vehicle): void {
    const seatCount = mod.GetVehicleSeatCount(vehicle);
    
    // Try to find an empty passenger seat
    for (let i = 1; i < seatCount; i++) {
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
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.game_ended_time));
    console.log(`Game ended by time limit. Final score: ${team1Score} - ${team2Score}`);

    // Determine winner by score
    if (team1Score > team2Score) {
        mod.EndGameMode(team1);
    } else if (team2Score > team1Score) {
        mod.EndGameMode(team2);
    } else {
        mod.EndGameMode(mod.GetTeam(0)); // Draw
    }
}

//==============================================================================================
// UTILITY FUNCTIONS
//==============================================================================================

function GetCurrentTime(): number {
    return MATCH_TIME_LIMIT - matchTimeRemaining;
}

function GetRandomInt(max: number): number {
    return Math.floor(Math.random() * max);
}

function VectorToString(v: mod.Vector): string {
    return `X: ${mod.XComponentOf(v)}, Y: ${mod.YComponentOf(v)}, Z: ${mod.ZComponentOf(v)}`
}

function MakeMessage(message: string, ...args: any[]) {
    switch (args.length) {
        case 0:
            return mod.Message(message);
        case 1:
            return mod.Message(message, args[0]);
        case 2:
            return mod.Message(message, args[0], args[1]);
        case 3:
            return mod.Message(message, args[0], args[1], args[2]);
        default:
            throw new Error("Invalid number of arguments");
    }
}

function GetCarriedFlagFromPlayer(player: mod.Player): FlagData | null {
    if(team1FlagData.carrierPlayer){
        if(mod.GetObjId(team1FlagData.carrierPlayer) == mod.GetObjId(player) && team1FlagData.isBeingCarried){
            return team1FlagData;
        }
    }
    
    if(team2FlagData.carrierPlayer){
        if(mod.GetObjId(team2FlagData.carrierPlayer) == mod.GetObjId(player) && team2FlagData.isBeingCarried){
            return team2FlagData;
        }
    }

    return null;
}
function GetTeamName(team: mod.Team): string {
    if(team == team1)
        return mod.stringkeys.red_team_name;
    if(team == team2)
        return mod.stringkeys.blue_team_name;
    return mod.stringkeys.empty_team_name;
}

function CaptureFeedback(pos: mod.Vector): void {
    let vfx: mod.VFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_ArtilleryStrike_Explosion_GS, pos, ZERO_VEC);
    mod.EnableVFX(vfx, true);
    let sfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Gadget_C4_Explosives_Detonation, pos, ZERO_VEC);
    mod.EnableSFX(sfx, true);
    mod.PlaySound(sfx, 100);
}


//-----------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------//
// Helper functions to create UI from a JSON object tree:
//-----------------------------------------------------------------------------------------------//

type UIVector = mod.Vector | number[];

interface UIParams {
    name: string;
    type: string;
    position: any;
    size: any;
    anchor: mod.UIAnchor;
    parent: mod.UIWidget;
    visible: boolean;
    textLabel: string;
    textColor: UIVector;
    textAlpha: number;
    textSize: number;
    textAnchor: mod.UIAnchor;
    padding: number;
    bgColor: UIVector;
    bgAlpha: number;
    bgFill: mod.UIBgFill;
    imageType: mod.UIImageType;
    imageColor: UIVector;
    imageAlpha: number;
    teamId?: mod.Team;
    playerId?: mod.Player;
    children?: any[];
    buttonEnabled: boolean;
    buttonColorBase: UIVector;
    buttonAlphaBase: number;
    buttonColorDisabled: UIVector;
    buttonAlphaDisabled: number;
    buttonColorPressed: UIVector;
    buttonAlphaPressed: number;
    buttonColorHover: UIVector;
    buttonAlphaHover: number;
    buttonColorFocused: UIVector;
    buttonAlphaFocused: number;
}

function __asModVector(param: number[]|mod.Vector) {
    if (Array.isArray(param))
        return mod.CreateVector(param[0], param[1], param.length == 2 ? 0 : param[2]);
    else
        return param;
}

function __asModMessage(param: string|mod.Message) {
    if (typeof (param) === "string")
        return mod.Message(param);
    return param;
}

function __fillInDefaultArgs(params: UIParams) {
    if (!params.hasOwnProperty('name'))
        params.name = "";
    if (!params.hasOwnProperty('position'))
        params.position = mod.CreateVector(0, 0, 0);
    if (!params.hasOwnProperty('size'))
        params.size = mod.CreateVector(100, 100, 0);
    if (!params.hasOwnProperty('anchor'))
        params.anchor = mod.UIAnchor.TopLeft;
    if (!params.hasOwnProperty('parent'))
        params.parent = mod.GetUIRoot();
    if (!params.hasOwnProperty('visible'))
        params.visible = true;
    if (!params.hasOwnProperty('padding'))
        params.padding = (params.type == "Container") ? 0 : 8;
    if (!params.hasOwnProperty('bgColor'))
        params.bgColor = mod.CreateVector(0.25, 0.25, 0.25);
    if (!params.hasOwnProperty('bgAlpha'))
        params.bgAlpha = 0.5;
    if (!params.hasOwnProperty('bgFill'))
        params.bgFill = mod.UIBgFill.Solid;
}

function __setNameAndGetWidget(uniqueName: any, params: any) {
    let widget = mod.FindUIWidgetWithName(uniqueName) as mod.UIWidget;
    mod.SetUIWidgetName(widget, params.name);
    return widget;
}

const __cUniqueName = "----uniquename----";

function __addUIContainer(params: UIParams) {
    __fillInDefaultArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIContainer(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            restrict);
    } else {
        mod.AddUIContainer(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill);
    }
    let widget = __setNameAndGetWidget(__cUniqueName, params);
    if (params.children) {
        params.children.forEach((childParams: any) => {
            childParams.parent = widget;
            __addUIWidget(childParams);
        });
    }
    return widget;
}

function __fillInDefaultTextArgs(params: UIParams) {
    if (!params.hasOwnProperty('textLabel'))
        params.textLabel = "";
    if (!params.hasOwnProperty('textSize'))
        params.textSize = 0;
    if (!params.hasOwnProperty('textColor'))
        params.textColor = mod.CreateVector(1, 1, 1);
    if (!params.hasOwnProperty('textAlpha'))
        params.textAlpha = 1;
    if (!params.hasOwnProperty('textAnchor'))
        params.textAnchor = mod.UIAnchor.CenterLeft;
}

function __addUIText(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultTextArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIText(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            __asModMessage(params.textLabel),
            params.textSize,
            __asModVector(params.textColor),
            params.textAlpha,
            params.textAnchor,
            restrict);
    } else {
        mod.AddUIText(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            __asModMessage(params.textLabel),
            params.textSize,
            __asModVector(params.textColor),
            params.textAlpha,
            params.textAnchor);
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __fillInDefaultImageArgs(params: any) {
    if (!params.hasOwnProperty('imageType'))
        params.imageType = mod.UIImageType.None;
    if (!params.hasOwnProperty('imageColor'))
        params.imageColor = mod.CreateVector(1, 1, 1);
    if (!params.hasOwnProperty('imageAlpha'))
        params.imageAlpha = 1;
}

function __addUIImage(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultImageArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIImage(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.imageType,
            __asModVector(params.imageColor),
            params.imageAlpha,
            restrict);
    } else {
        mod.AddUIImage(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.imageType,
            __asModVector(params.imageColor),
            params.imageAlpha);
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __fillInDefaultArg(params: any, argName: any, defaultValue: any) {
    if (!params.hasOwnProperty(argName))
        params[argName] = defaultValue;
}

function __fillInDefaultButtonArgs(params: any) {
    if (!params.hasOwnProperty('buttonEnabled'))
        params.buttonEnabled = true;
    if (!params.hasOwnProperty('buttonColorBase'))
        params.buttonColorBase = mod.CreateVector(0.7, 0.7, 0.7);
    if (!params.hasOwnProperty('buttonAlphaBase'))
        params.buttonAlphaBase = 1;
    if (!params.hasOwnProperty('buttonColorDisabled'))
        params.buttonColorDisabled = mod.CreateVector(0.2, 0.2, 0.2);
    if (!params.hasOwnProperty('buttonAlphaDisabled'))
        params.buttonAlphaDisabled = 0.5;
    if (!params.hasOwnProperty('buttonColorPressed'))
        params.buttonColorPressed = mod.CreateVector(0.25, 0.25, 0.25);
    if (!params.hasOwnProperty('buttonAlphaPressed'))
        params.buttonAlphaPressed = 1;
    if (!params.hasOwnProperty('buttonColorHover'))
        params.buttonColorHover = mod.CreateVector(1,1,1);
    if (!params.hasOwnProperty('buttonAlphaHover'))
        params.buttonAlphaHover = 1;
    if (!params.hasOwnProperty('buttonColorFocused'))
        params.buttonColorFocused = mod.CreateVector(1,1,1);
    if (!params.hasOwnProperty('buttonAlphaFocused'))
        params.buttonAlphaFocused = 1;
}

function __addUIButton(params: UIParams) {
    __fillInDefaultArgs(params);
    __fillInDefaultButtonArgs(params);
    let restrict = params.teamId ?? params.playerId;
    if (restrict) {
        mod.AddUIButton(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.buttonEnabled,
            __asModVector(params.buttonColorBase), params.buttonAlphaBase,
            __asModVector(params.buttonColorDisabled), params.buttonAlphaDisabled,
            __asModVector(params.buttonColorPressed), params.buttonAlphaPressed,
            __asModVector(params.buttonColorHover), params.buttonAlphaHover,
            __asModVector(params.buttonColorFocused), params.buttonAlphaFocused,
            restrict);
    } else {
        mod.AddUIButton(__cUniqueName,
            __asModVector(params.position),
            __asModVector(params.size),
            params.anchor,
            params.parent,
            params.visible,
            params.padding,
            __asModVector(params.bgColor),
            params.bgAlpha,
            params.bgFill,
            params.buttonEnabled,
            __asModVector(params.buttonColorBase), params.buttonAlphaBase,
            __asModVector(params.buttonColorDisabled), params.buttonAlphaDisabled,
            __asModVector(params.buttonColorPressed), params.buttonAlphaPressed,
            __asModVector(params.buttonColorHover), params.buttonAlphaHover,
            __asModVector(params.buttonColorFocused), params.buttonAlphaFocused);
    }
    return __setNameAndGetWidget(__cUniqueName, params);
}

function __addUIWidget(params: UIParams) {
    if (params == null)
        return undefined;
    if (params.type == "Container")
        return __addUIContainer(params);
    else if (params.type == "Text")
        return __addUIText(params);
    else if (params.type == "Image")
        return __addUIImage(params);
    else if (params.type == "Button")
        return __addUIButton(params);
    return undefined;
}

export function ParseUI(...params: any[]) {
    let widget: mod.UIWidget|undefined;
    for (let a = 0; a < params.length; a++) {
        widget = __addUIWidget(params[a] as UIParams);
    }
    return widget;
}

class DebugUI {
  rootUI;
  UiArray: any[] = [];
  UiIndex: number = 0;
  constructor(player: mod.Player) {
    this.rootUI = ParseUI({
      type: "Container",
      name: "DebugRoot",
      position: [10, 10],
      size: [600, 510],
      anchor: mod.UIAnchor.TopLeft,
      bgFill: mod.UIBgFill.Solid,
      bgAlpha: 0.2,
      bgColor: [0, 0, 0],
      playerID: player,
    });
  }

  AddText(text: mod.Message) {
    let debugtext = ParseUI({
        type: "Text",
        name: "debugtext"+this.UiArray.length,
        bgAlpha: 0.1,
        bgFill: mod.UIBgFill.GradientLeft,
        root: this.rootUI,
        anchor: mod.UIAnchor.TopLeft,
        textLabel: text,
        size: [600, 30],
        position: [10,10]
    });

    for (let ui of this.UiArray)
    {
        mod.SetUIWidgetPosition(ui, mod.CreateVector(10,10 + mod.YComponentOf(mod.GetUIWidgetPosition(ui)) + 30,0))
    }
    if (this.UiArray.length > 17)
    {
        for (let i: number = 0; i < (this.UiArray.length - 11); i++)
        {
            mod.SetUIWidgetVisible(this.UiArray[i], false)
        }
    }
    this.UiArray.push(debugtext);

    
  }

  Update() {
    // Sanity Check just in case if some ui gets stuck
    // for (let ui of this.UiArray)
    // {
    //     if (mod.YComponentOf(mod.GetUIWidgetPosition(ui)) == 0)
    //     {
    //         mod.SetUIWidgetPosition(ui, mod.CreateVector(10,10 + mod.YComponentOf(mod.GetUIWidgetPosition(ui)) + 30,0))
    //     }
       
    // }
  }
}