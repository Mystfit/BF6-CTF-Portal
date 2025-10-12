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
let playerScores: Map<number, PlayerScore>;


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
    flagWorldIcon: mod.WorldIcon;
    flagInteractPoint: mod.InteractPoint;
    captureZoneTrigger: mod.AreaTrigger;
    flagProp: mod.SpatialObject | null = null;
    carrierIcon: mod.WorldIcon | null = null;
    
    constructor(
        team: mod.Team, 
        homePosition: mod.Vector,
        flagInteractId: number,
        captureZoneId: number,
        flagIconId: number,
        flagProp: mod.SpatialObject
    ) {
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.homePosition = homePosition;
        this.currentPosition = homePosition;
        this.flagInteractPoint = mod.GetInteractPoint(flagInteractId);
        this.captureZoneTrigger = mod.GetAreaTrigger(captureZoneId);
        this.flagWorldIcon = mod.GetWorldIcon(flagIconId);
        this.flagProp = flagProp
        
        this.Initialize();
    }
    
    Initialize(): void {
        // Set up flag at home position
        this.SpawnFlagAtHome();
        
        // Configure world icon
        let flag_text = this.teamId === 1 ? mod.stringkeys.blue_flag_label : mod.stringkeys.red_flag_label
        mod.SetWorldIconText(this.flagWorldIcon, mod.Message(flag_text));
        mod.SetWorldIconPosition(this.flagWorldIcon, this.homePosition);
        mod.SetWorldIconColor(this.flagWorldIcon, this.GetTeamColor());
        mod.EnableWorldIconImage(this.flagWorldIcon, true);
        mod.EnableWorldIconText(this.flagWorldIcon, true);
        
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
        this.flagProp = mod.SpawnObject(
            mod.RuntimeSpawn_Common.BeverageFridge_01_B, 
            this.homePosition, 
            ZERO_VEC
        );

        if (DEBUG_MODE){
            // mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.spawning_flag, mod.XComponentOf(this.homePosition), mod.YComponentOf(this.homePosition), mod.ZComponentOf(this.homePosition)));
            console.log(`Spawning flag at ${this.homePosition}`);
        }
        
        // Update world icon
        mod.SetWorldIconPosition(this.flagWorldIcon, this.homePosition);
        mod.SetWorldIconColor(this.flagWorldIcon, this.GetTeamColor());
        mod.EnableWorldIconImage(this.flagWorldIcon, true);
        mod.EnableWorldIconText(this.flagWorldIcon, true);
    }
    
    PickupFlag(player: mod.Player): void {
        if (!this.canBePickedUp) {
            if (DEBUG_MODE) {
                console.log("Flag cannot be picked up yet (delay active)");
                mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.flag_pickup_delay));
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
        
        // Restrict carrier's weapons
        this.RestrictCarrierWeapons(player);
        
        // Add UI icon above carrier
        mod.AddUIIcon(
            player,
            mod.WorldIconImages.Flag,
            3.0,
            this.GetTeamColor(),
            mod.Message("FLAG CARRIER")
        );
        
        // Hide flag position icon, we'll track carrier position
        mod.EnableWorldIconImage(this.flagWorldIcon, false);
        mod.EnableWorldIconText(this.flagWorldIcon, false);
        
        // Notify all players
        const carrierTeam = mod.GetTeam(this.carrierPlayer);
        const carrierTeamId = mod.GetObjId(carrierTeam);
        const message = this.teamId === 1 
            ? mod.Message(mod.stringkeys.blue_flag_taken) 
            : mod.Message(mod.stringkeys.red_flag_taken);
        mod.DisplayNotificationMessage(message);
        
        if (DEBUG_MODE) {
            console.log(`Flag picked up by player on team ${carrierTeamId}`);
            mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.flag_picked_up, carrierTeamId));
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
            mod.RuntimeSpawn_Common.WorldIcon,
            this.currentPosition,
            ZERO_VEC
        );
        
        // Start timers
        this.dropTime = GetCurrentTime();
        this.canPickupTime = this.dropTime + FLAG_PICKUP_DELAY;
        this.autoReturnTime = this.dropTime + FLAG_AUTO_RETURN_TIME;
        this.canBePickedUp = false;
        
        // Update world icon
        mod.SetWorldIconPosition(this.flagWorldIcon, this.currentPosition);
        mod.SetWorldIconColor(this.flagWorldIcon, DROPPED_FLAG_COLOR);
        mod.EnableWorldIconImage(this.flagWorldIcon, true);
        mod.EnableWorldIconText(this.flagWorldIcon, true);
        
        // Start pickup delay
        this.StartPickupDelay();
        
        // Notify players
        const message = this.teamId === 1 
            ? mod.Message(mod.stringkeys.blue_flag_dropped)
            : mod.Message(mod.stringkeys.red_flag_dropped);
        mod.DisplayNotificationMessage(message);
        
        if (DEBUG_MODE) {
            console.log(`Flag dropped at position: ${VectorToString(this.currentPosition)}`);
            mod.DisplayNotificationMessage(
                mod.Message(mod.stringkeys.flag_dropped, VectorToString(this.currentPosition))
            );
        }
    }
    
    async StartPickupDelay(): Promise<void> {
        await mod.Wait(FLAG_PICKUP_DELAY);
        if (this.isDropped) {
            this.canBePickedUp = true;
            if (DEBUG_MODE) {
                console.log("Flag can now be picked up");
                mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.flag_can_pickup));
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
        mod.DisplayNotificationMessage(message);
        
        if (DEBUG_MODE) {
            console.log(`Flag returned to base for team ${this.teamId}`);
            mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.flag_returned, this.teamId));
        }
    }
    
    CheckAutoReturn(): void {
        if (!this.isDropped) return;
        
        const currentTime = GetCurrentTime();
        if (currentTime >= this.autoReturnTime) {
            if (DEBUG_MODE) {
                console.log("Flag auto-returning to base");
                mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.flag_auto_return));
            }
            this.ReturnToBase();
        }
    }
    
    UpdateCarrierPosition(): void {
        if (!this.isBeingCarried || !this.carrierPlayer) return;
        
        if (!mod.IsPlayerValid(this.carrierPlayer) || 
            !mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsAlive)) {
            return;
        }
        
        this.currentPosition = mod.GetSoldierState(
            this.carrierPlayer, 
            mod.SoldierStateVector.GetPosition
        );
    }
    
    RestrictCarrierWeapons(player: mod.Player): void {
        // Remove all weapons
        mod.RemoveEquipment(player, mod.InventorySlots.PrimaryWeapon);
        mod.RemoveEquipment(player, mod.InventorySlots.SecondaryWeapon);
        mod.RemoveEquipment(player, mod.InventorySlots.ClassGadget);
        mod.RemoveEquipment(player, mod.InventorySlots.GadgetOne);
        mod.RemoveEquipment(player, mod.InventorySlots.GadgetTwo);
        mod.RemoveEquipment(player, mod.InventorySlots.MiscGadget);
        mod.RemoveEquipment(player, mod.InventorySlots.Throwable);
        
        // Force equip sledgehammer
        mod.AddEquipment(player, mod.Gadgets.Melee_Sledgehammer);
        mod.ForceSwitchInventory(player, mod.InventorySlots.MeleeWeapon);
        
        if (DEBUG_MODE) {
            console.log("Carrier weapons restricted");
            // mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.carrier_weapons_restricted));
        }
    }
    
    RestoreCarrierWeapons(player: mod.Player): void {
        // Note: In a full implementation, you'd want to track and restore the player's original loadout
        // For now, we'll just remove the sledgehammer and let them pick up weapons
        if (DEBUG_MODE) {
            console.log("Carrier weapons restored");
            mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.carrier_weapons_restored));
        }
    }
    
    GetTeamColor(): mod.Vector {
        return this.teamId === 1 ? TEAM1_COLOR : TEAM2_COLOR;
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
    mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.ctf_version_started, VERSION[0], VERSION[1], VERSION[2]));
    mod.SendErrorReport(mod.Message(mod.stringkeys.ctf_version_started, VERSION[0], VERSION[1], VERSION[2]));

    // Initialize teams
    team1 = mod.GetTeam(1);
    team2 = mod.GetTeam(2);

    // Set scoreboard
    mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams);
    mod.SetScoreboardHeader(mod.Message(mod.stringkeys.blue_team_name), mod.Message(mod.stringkeys.red_team_name));
    mod.SetScoreboardColumnNames(mod.Message(mod.stringkeys.scoreboard_captures_label), mod.Message(mod.stringkeys.scoreboard_capture_assists_label));

    playerScores = new Map<number, PlayerScore>();

    // Get flag positions from InteractPoint objects
    const team1FlagInteract = mod.GetInteractPoint(TEAM1_FLAG_INTERACT_ID);
    const team2FlagInteract = mod.GetInteractPoint(TEAM2_FLAG_INTERACT_ID);
    const team1WorldIcon = mod.GetWorldIcon(TEAM1_FLAG_ICON_ID);
    const team2WorldIcon = mod.GetWorldIcon(TEAM2_FLAG_ICON_ID);
    const team1WorldModel = mod.GetSpatialObject(TEAM1_FLAG_MODEL_ID);
    const team2WorldModel = mod.GetSpatialObject(TEAM2_FLAG_MODEL_ID);
    const team1FlagPosition = mod.GetObjectPosition(team1WorldModel);
    const team2FlagPosition = mod.GetObjectPosition(team2WorldModel);
    
    // mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.red_flag_position, mod.XComponentOf(team1FlagPosition), mod.YComponentOf(team1FlagPosition), mod.ZComponentOf(team1FlagPosition)));
    // mod.SendErrorReport(mod.Message(mod.stringkeys.red_flag_position, mod.XComponentOf(team1FlagPosition), mod.YComponentOf(team1FlagPosition), mod.ZComponentOf(team1FlagPosition)));
    // mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.blue_flag_position, mod.XComponentOf(team2FlagPosition), mod.YComponentOf(team2FlagPosition), mod.ZComponentOf(team2FlagPosition)));

    // Initialize flags
    team1FlagData = new FlagData(
        team1,
        team1FlagPosition,
        TEAM1_FLAG_INTERACT_ID,
        TEAM1_CAPTURE_ZONE_ID,
        TEAM1_FLAG_ICON_ID,
        team1WorldModel
    );
    
    team2FlagData = new FlagData(
        team2,
        team2FlagPosition,
        TEAM2_FLAG_INTERACT_ID,
        TEAM2_CAPTURE_ZONE_ID,
        TEAM2_FLAG_ICON_ID,
        team2WorldModel
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
    mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.ctf_initialized));
}

async function TickUpdate(): Promise<void> {
    const tickRate = 0.016; // ~60fps
    
    while (gameStarted) {
        await mod.Wait(tickRate);
        
        // Update flag carrier positions
        if (team1FlagData.isBeingCarried) {
            team1FlagData.UpdateCarrierPosition();
        }
        
        if (team2FlagData.isBeingCarried) {
            team2FlagData.UpdateCarrierPosition();
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
        // team1FlagData.CheckAutoReturn();
        // team2FlagData.CheckAutoReturn();
        
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
        mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.player_joined, mod.GetObjId(eventPlayer)));
    }

    // Guarantee default player score
    playerScores.set(mod.GetObjId(eventPlayer), new PlayerScore());
}

export function OnPlayerLeaveGame(eventNumber: number): void {
    // Check if leaving player was carrying a flag
    if (team1FlagData.carrierPlayer && mod.GetObjId(team1FlagData.carrierPlayer) === eventNumber) {
        team1FlagData.DropFlag();
    }
    
    if (team2FlagData.carrierPlayer && mod.GetObjId(team2FlagData.carrierPlayer) === eventNumber) {
        team2FlagData.DropFlag();
    }
    
    if (DEBUG_MODE) {
        console.log(`Player left: ${eventNumber}`);
        mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.player_left, eventNumber));
    }
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
    if (team1FlagData.carrierPlayer === eventPlayer) {
        team1FlagData.DropFlag();
    }
    
    if (team2FlagData.carrierPlayer === eventPlayer) {
        team2FlagData.DropFlag();
    }
}

export function OnPlayerInteract(
    eventPlayer: mod.Player, 
    eventInteractPoint: mod.InteractPoint
): void {
    const interactId = mod.GetObjId(eventInteractPoint);
    const playerTeamId = mod.GetObjId(mod.GetTeam(eventPlayer));
    
    if (DEBUG_MODE) {
        mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.player_interact, eventPlayer, mod.GetObjId(eventInteractPoint)))
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
        mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.on_capture_zone_entered, eventPlayer, playerTeamId, triggerId))
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
        mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.player_exit_trigger, eventPlayer, mod.GetObjId(eventAreaTrigger)))
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
            mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.carrier_enter_vehicle))
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
            mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.forced_to_seat))
            ForceToPassengerSeat(eventPlayer, eventVehicle);
        }
    }
}

export function OnGameModeEnding(): void {
    gameStarted = false;
    console.log("CTF: Game ending");
    mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.ctf_ending))
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
        // mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.red_flag_position, mod.XComponentOf(flagData.homePosition), mod.YComponentOf(flagData.homePosition), mod.ZComponentOf(flagData.homePosition)));
    }

    // Enemy team trying to take flag
    if (playerTeamId !== flagData.teamId) {
        if (flagData.isAtHome || (flagData.isDropped && flagData.canBePickedUp)) {
            flagData.PickupFlag(player);
        } else if (flagData.isDropped && !flagData.canBePickedUp) {
            mod.DisplayNotificationMessage(
                mod.Message(mod.stringkeys.waiting_to_take_flag),
                player
            );
        }
    }
    // Own team trying to return dropped flag
    // else if (playerTeamId === flagData.teamId && flagData.isDropped) {
    //     mod.DisplayNotificationMessage(
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
            mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.flag_from_player_result, player, GetTeamName(mod.GetTeam(heldFlag.carrierPlayer))));
            if(mod.GetObjId(heldFlag.team) != mod.GetObjId(mod.GetTeam(heldFlag.carrierPlayer))){
                isCarryingEnemyFlag = true;
            }
        } else {
            mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.flag_owner_error, player));
        }
    } else {
        mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.flag_not_held_error, player));
    }
    
    if (!isCarryingEnemyFlag) {
        mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.not_carrying_flag, player))
        return;
    }
    
    // Check if own flag is at home
    const ownFlagData = playerTeamId === mod.GetObjId(team1) ? team1FlagData : team2FlagData;
    
    if (!ownFlagData.isAtHome) {
        mod.DisplayNotificationMessage(
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
    if (player_score !== undefined) {
        player_score.captures += 1;
        mod.SetScoreboardPlayerValues(scoringPlayer, player_score.captures, player_score.capture_assists);
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
    mod.DisplayNotificationMessage(
        mod.Message(mod.stringkeys.team_scored, scoringTeamId, team1Score, team2Score)
    );
    
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
    mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.game_ended_score, winningTeamId))
    mod.EndGameMode(winningTeam);    
}

function EndGameByTime(): void {
    gameStarted = false;
    mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.game_ended_time));
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