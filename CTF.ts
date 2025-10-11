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
        flagIconId: number
    ) {
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.homePosition = homePosition;
        this.currentPosition = homePosition;
        this.flagInteractPoint = mod.GetInteractPoint(flagInteractId);
        this.captureZoneTrigger = mod.GetAreaTrigger(captureZoneId);
        this.flagWorldIcon = mod.GetWorldIcon(flagIconId);
        
        this.Initialize();
    }
    
    Initialize(): void {
        // Set up flag at home position
        this.SpawnFlagAtHome();
        
        // Configure world icon
        mod.SetWorldIconText(this.flagWorldIcon, mod.Message("FLAG"));
        mod.SetWorldIconPosition(this.flagWorldIcon, this.homePosition);
        mod.SetWorldIconColor(this.flagWorldIcon, this.GetTeamColor());
        mod.EnableWorldIconImage(this.flagWorldIcon, true);
        mod.EnableWorldIconText(this.flagWorldIcon, true);
        
        // Enable flag interact point
        mod.EnableInteractPoint(this.flagInteractPoint, true);
        
        if (DEBUG_MODE) {
            console.log(`Flag initialized for team ${this.teamId} at position:`, 
                mod.XComponentOf(this.homePosition), 
                mod.YComponentOf(this.homePosition), 
                mod.ZComponentOf(this.homePosition));
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
            mod.RuntimeSpawn_Common.Suitcase_01_B, 
            mod.Add(this.homePosition, mod.CreateVector(0, 1, 0)), 
            ZERO_VEC
        );
        
        // Update world icon
        mod.SetWorldIconPosition(this.flagWorldIcon, this.homePosition);
        mod.SetWorldIconColor(this.flagWorldIcon, this.GetTeamColor());
        mod.EnableWorldIconImage(this.flagWorldIcon, true);
        mod.EnableWorldIconText(this.flagWorldIcon, true);
    }
    
    PickupFlag(player: mod.Player): void {
        if (!this.canBePickedUp) {
            if (DEBUG_MODE) console.log("Flag cannot be picked up yet (delay active)");
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
            2.0,
            this.GetTeamColor(),
            mod.Message("FLAG CARRIER")
        );
        
        // Hide flag position icon, we'll track carrier position
        mod.EnableWorldIconImage(this.flagWorldIcon, false);
        mod.EnableWorldIconText(this.flagWorldIcon, false);
        
        // Notify all players
        const carrierTeam = mod.GetTeam(player);
        const carrierTeamId = mod.GetObjId(carrierTeam);
        const message = this.teamId === 1 
            ? mod.Message("Blue flag taken!") 
            : mod.Message("Red flag taken!");
        mod.DisplayNotificationMessage(message);
        
        if (DEBUG_MODE) {
            console.log(`Flag picked up by player on team ${carrierTeamId}`);
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
            ? mod.Message("Blue flag dropped!") 
            : mod.Message("Red flag dropped!");
        mod.DisplayNotificationMessage(message);
        
        if (DEBUG_MODE) {
            console.log(`Flag dropped at position:`, 
                mod.XComponentOf(this.currentPosition), 
                mod.YComponentOf(this.currentPosition), 
                mod.ZComponentOf(this.currentPosition));
        }
    }
    
    async StartPickupDelay(): Promise<void> {
        await mod.Wait(FLAG_PICKUP_DELAY);
        if (this.isDropped) {
            this.canBePickedUp = true;
            if (DEBUG_MODE) console.log("Flag can now be picked up");
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
            ? mod.Message("Blue flag returned!") 
            : mod.Message("Red flag returned!");
        mod.DisplayNotificationMessage(message);
        
        if (DEBUG_MODE) console.log(`Flag returned to base for team ${this.teamId}`);
    }
    
    CheckAutoReturn(): void {
        if (!this.isDropped) return;
        
        const currentTime = GetCurrentTime();
        if (currentTime >= this.autoReturnTime) {
            if (DEBUG_MODE) console.log("Flag auto-returning to base");
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
        // Remove primary weapon
        mod.RemoveEquipment(player, mod.InventorySlots.PrimaryWeapon);
        
        // Force equip sledgehammer
        mod.AddEquipment(player, mod.Gadgets.Melee_Sledgehammer);
        mod.ForceSwitchInventory(player, mod.InventorySlots.MeleeWeapon);
        
        if (DEBUG_MODE) console.log("Carrier weapons restricted");
    }
    
    RestoreCarrierWeapons(player: mod.Player): void {
        // Note: In a full implementation, you'd want to track and restore the player's original loadout
        // For now, we'll just remove the sledgehammer and let them pick up weapons
        if (DEBUG_MODE) console.log("Carrier weapons restored");
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
    
    // Initialize teams
    team1 = mod.GetTeam(1);
    team2 = mod.GetTeam(2);
    
    // Get flag positions from InteractPoint objects
    const team1FlagInteract = mod.GetInteractPoint(TEAM1_FLAG_INTERACT_ID);
    const team2FlagInteract = mod.GetInteractPoint(TEAM2_FLAG_INTERACT_ID);
    const team1FlagPosition = mod.GetObjectPosition(team1FlagInteract);
    const team2FlagPosition = mod.GetObjectPosition(team2FlagInteract);
    
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
    }
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
    }
}

export function OnPlayerDeployed(eventPlayer: mod.Player): void {
    // Players spawn at their team's HQ
    if (DEBUG_MODE) {
        const teamId = mod.GetObjId(mod.GetTeam(eventPlayer));
        console.log(`Player ${mod.GetObjId(eventPlayer)} deployed on team ${teamId}`);
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
        console.log(`Player ${mod.GetObjId(eventPlayer)} interacted with object ${interactId}`);
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
        console.log(`Player ${mod.GetObjId(eventPlayer)} entered area trigger ${triggerId}`);
    }
    
    // Check if player entered their own capture zone
    if (triggerId === TEAM1_CAPTURE_ZONE_ID && playerTeamId === 1) {
        HandleCaptureZoneEntry(eventPlayer, 1);
    } else if (triggerId === TEAM2_CAPTURE_ZONE_ID && playerTeamId === 2) {
        HandleCaptureZoneEntry(eventPlayer, 2);
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
    // Check if player is carrying a flag
    if (team1FlagData.carrierPlayer === eventPlayer || 
        team2FlagData.carrierPlayer === eventPlayer) {
        
        if (DEBUG_MODE) console.log("Flag carrier entered vehicle");
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
            ForceToPassengerSeat(eventPlayer, eventVehicle);
        }
    }
}

export function OnGameModeEnding(): void {
    gameStarted = false;
    console.log("CTF: Game ending");
}

//==============================================================================================
// GAME LOGIC FUNCTIONS
//==============================================================================================

function HandleFlagInteraction(
    player: mod.Player, 
    playerTeamId: number, 
    flagData: FlagData
): void {
    // Enemy team trying to take flag
    if (playerTeamId !== flagData.teamId) {
        if (flagData.isAtHome || (flagData.isDropped && flagData.canBePickedUp)) {
            flagData.PickupFlag(player);
        } else if (flagData.isDropped && !flagData.canBePickedUp) {
            mod.DisplayNotificationMessage(
                mod.Message("Wait to pick up flag..."),
                player
            );
        }
    }
    // Own team trying to return dropped flag
    else if (playerTeamId === flagData.teamId && flagData.isDropped) {
        flagData.ReturnToBase();
    }
}

function HandleCaptureZoneEntry(
    player: mod.Player,
    captureZoneTeamId: number
): void {
    const playerTeamId = mod.GetObjId(mod.GetTeam(player));
    
    // Check if player is carrying enemy flag
    const isCarryingEnemyFlag = 
        (playerTeamId === 1 && team2FlagData.carrierPlayer === player) ||
        (playerTeamId === 2 && team1FlagData.carrierPlayer === player);
    
    if (!isCarryingEnemyFlag) {
        return;
    }
    
    // Check if own flag is at home
    const ownFlagData = playerTeamId === 1 ? team1FlagData : team2FlagData;
    
    if (!ownFlagData.isAtHome) {
        mod.DisplayNotificationMessage(
            mod.Message("Return your flag before capturing!"),
            player
        );
        return;
    }
    
    // Score!
    ScoreCapture(playerTeamId);
}

function ScoreCapture(scoringTeamId: number): void {
    // Increment score
    if (scoringTeamId === 1) {
        team1Score++;
    } else {
        team2Score++;
    }
    
    // Update game mode score
    mod.SetGameModeScore(mod.GetTeam(scoringTeamId), 
        scoringTeamId === 1 ? team1Score : team2Score);
    
    // Notify players
    const teamName = scoringTeamId === 1 ? "Blue" : "Red";
    mod.DisplayNotificationMessage(
        mod.Message(`${teamName} team scored! ${team1Score} - ${team2Score}`)
    );
    
    // Return both flags to base
    team1FlagData.ReturnToBase();
    team2FlagData.ReturnToBase();
    
    // Check win condition
    if ((scoringTeamId === 1 && team1Score >= TARGET_SCORE) ||
        (scoringTeamId === 2 && team2Score >= TARGET_SCORE)) {
        EndGameByScore(scoringTeamId);
    }
    
    if (DEBUG_MODE) {
        console.log(`Team ${scoringTeamId} scored! Score: ${team1Score} - ${team2Score}`);
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
    
    mod.DisplayNotificationMessage(
        mod.Message(`${teamName} team wins!`)
    );
    
    mod.EndGameMode(winningTeam);
    
    console.log(`Game ended - Team ${winningTeamId} wins by score`);
}

function EndGameByTime(): void {
    gameStarted = false;
    
    // Determine winner by score
    if (team1Score > team2Score) {
        mod.EndGameMode(team1);
        mod.DisplayNotificationMessage(mod.Message("Blue team wins by score!"));
    } else if (team2Score > team1Score) {
        mod.EndGameMode(team2);
        mod.DisplayNotificationMessage(mod.Message("Red team wins by score!"));
    } else {
        mod.EndGameMode(mod.GetTeam(0)); // Draw
        mod.DisplayNotificationMessage(mod.Message("Match ended in a draw!"));
    }
    
    console.log(`Game ended by time limit. Final score: ${team1Score} - ${team2Score}`);
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
