

try{throw Error("Line offset check");} catch(error: unknown){if(error instanceof Error) console.log(`Script line offset: ${error.stack}`);};
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
 * FLAG LIFECYCLE EXPLAINED:
 * =========================
 * 1. AT HOME (isAtHome=true)
 *    - Flag sits at spawn point with interaction point
 *    - Opposing teams can pick it up
 *    - Own team sees "DEFEND" icons
 *
 * 2. BEING CARRIED (isBeingCarried=true)
 *    - Player picked up flag -> becomes carrier
 *    - Carrier forced to melee weapon (can't shoot)
 *    - Carrier can't drive vehicles (forced to passenger seat)
 *    - VFX smoke trail follows carrier
 *    - Icons update to show "PICKUP" or "RECOVER" for different teams
 *
 * 3. DROPPED (isDropped=true)
 *    - Carrier died or manually dropped flag
 *    - 3-second delay before anyone can pick it up
 *    - Auto-returns to base after 30 seconds if not picked up
 *    - Own team can return it early by interacting
 *
 * 4. SCORING
 *    - Carrier enters their team's capture zone with enemy flag
 *    - Must have own flag at home to score
 *    - Team gets 1 point, first to TARGET_SCORE wins
 *
 * MULTI-TEAM SUPPORT:
 * ===================
 * - Configurable 2-7 team gameplay via GameModeConfig
 * - Each flag can restrict which teams can capture it
 * - Dynamic scoreboard adapts to team count
 * - Team balance system moves players between teams
 *
 * CONFIGURATION SYSTEM:
 * =====================
 * To create a custom game mode, define a GameModeConfig:
 * 
 * const config = {
 *   teams: [
 *     { teamId: 1, name: "Red", color: redVector},
 *     { teamId: 2, name: "Blue", color: blueVector}
 *   ],
 *   flags: [
 *     { flagId: 1, owningTeamId: 1 },  // Red flag
 *     { flagId: 2, owningTeamId: 2 }   // Blue flag
 *   ]
 * };
 * 
 * Then call LoadGameModeConfig(config) to apply it.
 */

//@ts-ignore
import * as modlib from 'modlib';

const VERSION = [1, 2, 0];

//==============================================================================================
// CONFIGURATION
//==============================================================================================

const DEBUG_MODE = true;                                            // Print extra debug messages

// Game Settings
const GAMEMODE_TARGET_SCORE = 5;                                     // Points needed to win

// Flag settings
const FLAG_PICKUP_DELAY = 3;                                        // Seconds before dropped flag can be picked up
const FLAG_AUTO_RETURN_TIME = 30;                                   // Seconds before dropped flag auto-returns to base
const FLAG_PROP = mod.RuntimeSpawn_Common.MCOM;                     // Prop representing a flag at a spawner and when dropped
const FLAG_FOLLOW_MODE = true;                                     // Flag follows the player.

// Flag carrier settings
const CARRIER_FORCED_WEAPON = mod.Gadgets.Melee_Sledgehammer;       // Weapon to automatically give to a flag carrier when a flag is picked up
const CARRIER_FORCED_WEAPON_SLOT = mod.InventorySlots.MeleeWeapon;  // Force flag carrier to swap to this slot on flag pickup, swapping will drop flag
const CARRIER_CAN_HOLD_MULTIPLE_FLAGS = true;                       // Let the flag carrier pick up multiple flags at once

// Team balance
const TEAM_AUTO_BALANCE: boolean = true;                            // Make sure teams are evenly balanced 
const TEAM_BALANCE_DELAY = 5.0;                                     // Seconds to delay before auto-balancing teams
const TEAM_BALANCE_CHECK_INTERVAL = 10;                             // Check balance every N seconds


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
const FLAG_THROW_SPEED = 6;                                         // Speed in units p/s to throw a flag away from a player
const FLAG_FOLLOW_DISTANCE = 3;                                     // Distance flag will follow the player at
const FLAG_FOLLOW_POSITION_SMOOTHING = 0.5;                         // Exponential smoothing factor for position (0-1, lower = smoother)
const FLAG_FOLLOW_ROTATION_SMOOTHING = 0.5;                         // Exponential smoothing factor for rotation (0-1, lower = smoother)
const FLAG_FOLLOW_SAMPLES = 20;
const FLAG_TERRAIN_RAYCAST_SUPPORT = false;                         // TODO: Temp hack until terrain raycasts fixed. Do we support raycasts against terrain?
const SOLDIER_HALF_HEIGHT = 0.75;                                   // Midpoint of a soldier used for raycasts
const SOLDIER_HEIGHT = 2;                                           // Full soldier height

// Spawn validation settings
const SPAWN_VALIDATION_DIRECTIONS = 4;                              // Number of radial check directions
const SPAWN_VALIDATION_MAX_ITERATIONS = 1;                          // Maximum adjustment passes
const SPAWN_VALIDATION_HEIGHT_OFFSET = 0.5;                         // Height offset above adjusted position for ground detection ray

// Vehicle seat indices
const VEHICLE_DRIVER_SEAT = 0;                                      // Driver seat index in vehicles
const VEHICLE_FIRST_PASSENGER_SEAT = 1;                             // First passenger seat index

// Update rates
const TICK_RATE = 0.032;                                            // ~30fps update rate for carrier position updates (portal server tickrate)


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


//==============================================================================================
// MAIN GAME LOOP
//==============================================================================================

export async function OnGameModeStarted() {
    console.log(`CTF Game Mode v${VERSION[0]}.${VERSION[1]}.${VERSION[2]} Started`);
    if(DEBUG_MODE)
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_version_started, VERSION[0], VERSION[1], VERSION[2]));

    // Initialize legacy team references (still needed for backwards compatibility)
    teamNeutral = mod.GetTeam(TeamID.TEAM_NEUTRAL);
    team1 = mod.GetTeam(TeamID.TEAM_1);
    team2 = mod.GetTeam(TeamID.TEAM_2);
    team3 = mod.GetTeam(TeamID.TEAM_3);
    team4 = mod.GetTeam(TeamID.TEAM_4);

    await mod.Wait(1);

    // Load game mode configuration
    let config = ClassicCTFConfig;
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

    // Start game
    gameStarted = true;
    
    // Start update loops
    TickUpdate();
    SecondUpdate();
    
    console.log("CTF: Game initialized and started");
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_initialized));

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
        
        // Update all players UI instances
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

        lastSecondUpdateTime = currentTime;
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

    // Make sure we create a JSPlayer for our new player
    JSPlayer.get(eventPlayer);

    // Trigger team balance check
    CheckAndBalanceTeams();

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
    JSPlayer.get(eventPlayer);
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
        if (mod.GetPlayerVehicleSeat(eventPlayer) === VEHICLE_DRIVER_SEAT) {
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

function RefreshScoreboard(){
    for(let jsPlayer of JSPlayer.getAllAsArray()){
        UpdatePlayerScoreboard(jsPlayer.player);
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
        CaptureFeedback(scoringTeamFlag.homePosition);

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
    GetCarriedFlags(scoringPlayer).forEach((flag:Flag) => flag.ResetFlag());
    
    // Check win condition
    if (currentScore >= GAMEMODE_TARGET_SCORE) {
        EndGameByScore(scoringTeamId);
    }
}

function ForceToPassengerSeat(player: mod.Player, vehicle: mod.Vehicle): void {
    const seatCount = mod.GetVehicleSeatCount(vehicle);
    
    // Try to find an empty passenger seat
    for (let i = seatCount-1; i >= VEHICLE_FIRST_PASSENGER_SEAT; --i) {
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


// Godot flag IDs
// --------------

async function CaptureFeedback(pos: mod.Vector): Promise<void> {
    let vfx: mod.VFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_BASE_Sparks_Pulse_L, pos, ZERO_VEC);
    let sfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_OnCapturedByFriendly_OneShot2D, pos, ZERO_VEC);
    mod.PlaySound(sfx, 1);

    // Cleanup
    mod.Wait(5);
    mod.UnspawnObject(sfx);
    mod.UnspawnObject(vfx);
}


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

            const rayResult = player ? await this.castWithPlayer(player, currentPos, nextPos, debug) : await RaycastManager.cast(currentPos, nextPos, debug);
            
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
        debug: boolean = false
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
 * AnimationManager - Asynchronous object animation system
 * 
 * Provides complex animation capabilities beyond the basic MoveObjectOverTime function.
 * Supports path-based animations, speed/duration control, rotation, and callbacks.
 * 
 * Usage:
 *   await animationManager.AnimateAlongPath(object, points, { speed: 10 });
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
    rotationSpeed?: number;      // How fast to rotate in degrees/second (default: instant)
    loop?: boolean;              // Loop the animation
    reverse?: boolean;           // Reverse after completion
    onProgress?: (progress: number, position: mod.Vector) => void;
    onComplete?: () => void;
    onSegmentComplete?: (segmentIndex: number) => void;
}

interface ActiveAnimation {
    object: mod.Object;
    objectId: number;
    cancelled: boolean;
    paused: boolean;
    progress: number;
}

class AnimationManager {
    private activeAnimations: Map<number, ActiveAnimation> = new Map();

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
                totalDistance += VectorLength(Math2.Vec3.FromVector(points[i + 1]).Subtract(Math2.Vec3.FromVector(points[i])).ToVector()); //mod.Subtract(points[i + 1], points[i]));
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
                const segmentDistance = VectorLength(Math2.Vec3.FromVector(endPoint).Subtract(Math2.Vec3.FromVector(startPoint)).ToVector()); //mod.Subtract(endPoint, startPoint));
                const segmentDuration = (segmentDistance / totalDistance) * totalDuration;

                // Calculate rotation if needed
                let rotation = ZERO_VEC;
                if (options.rotateToDirection) {
                    rotation = this.CalculateRotationFromDirection(
                        Math2.Vec3.FromVector(endPoint).Subtract(Math2.Vec3.FromVector(startPoint)).ToVector() //mod.Subtract(endPoint, startPoint)
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
        const positionDelta = Math2.Vec3.FromVector(endPos).Subtract(Math2.Vec3.FromVector(startPos)).ToVector(); //mod.Subtract(endPos, startPos);
        const rotationDelta = options.rotation || ZERO_VEC;

        if (DEBUG_MODE) {
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
     * Calculate Euler rotation to face a direction vector
     * @param direction Direction vector to face
     * @returns Rotation vector (Euler angles in radians)
     */
    private CalculateRotationFromDirection(direction: mod.Vector): mod.Vector {
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
        object: mod.Object,
        generator: AsyncGenerator<ProjectilePoint>,
        minBufferSize: number,
        options: AnimationOptions = {}
    ): Promise<void> {
        const objectId = mod.GetObjId(object);
        
        // Register active animation
        const animation: ActiveAnimation = {
            object,
            objectId,
            cancelled: false,
            paused: false,
            progress: 0
        };
        this.activeAnimations.set(objectId, animation);

        const pointBuffer: ProjectilePoint[] = [];
        let generatorComplete = false;
        let currentPosition: mod.Vector;
        let animationStarted = false;
        let bufferStarvationCount = 0;

        try {
            if(DEBUG_MODE) console.log(`[AnimateAlongGeneratedPath] Starting concurrent animation with buffer size ${minBufferSize}`);

            // Phase 1: Fill initial buffer (minBufferSize + 2 points)
            const initialBufferSize = minBufferSize + 2;
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

            // Set starting position
            currentPosition = pointBuffer[0].position;
            
            if(DEBUG_MODE) {
                console.log(`[AnimateAlongGeneratedPath] Initial buffer filled with ${pointBuffer.length} points, starting animation`);
            }

            // Phase 2: Concurrent animation and generation
            animationStarted = true;
            let segmentIndex = 0;
            
            while (pointBuffer.length > 1 || !generatorComplete) {
                if (animation.cancelled) break;

                // Check if we need to wait for more points
                if (pointBuffer.length <= minBufferSize && !generatorComplete) {
                    if(DEBUG_MODE) {
                        console.log(`[AnimateAlongGeneratedPath] Buffer low (${pointBuffer.length} points), waiting for generator...`);
                    }
                    bufferStarvationCount++;
                    
                    // Try to fill buffer back up
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

                // If generator is still running and buffer has room, try to add more points
                if (!generatorComplete && pointBuffer.length < initialBufferSize * 2) {
                    const result = await generator.next();
                    if (result.done) {
                        generatorComplete = true;
                        if(DEBUG_MODE) console.log(`[AnimateAlongGeneratedPath] Generator completed`);
                    } else {
                        pointBuffer.push(result.value);
                    }
                }

                // Check if we should stop consuming points (hit detected or at end)
                const shouldStopConsuming = generatorComplete && pointBuffer.length <= minBufferSize + 2;
                
                if (shouldStopConsuming) {
                    if(DEBUG_MODE) {
                        console.log(`[AnimateAlongGeneratedPath] Stopping animation consumption, ${pointBuffer.length} points remaining in buffer`);
                    }
                    break;
                }

                // Animate to next point
                if (pointBuffer.length > 1) {
                    const startPoint = pointBuffer.shift()!; // Remove first point
                    const endPoint = pointBuffer[0]; // Peek at next point (don't remove yet)
                    
                    const segmentDistance = VectorLength(
                        Math2.Vec3.FromVector(endPoint.position)
                            .Subtract(Math2.Vec3.FromVector(startPoint.position))
                            .ToVector()
                    );
                    
                    const segmentDuration = options.speed ? segmentDistance / options.speed : 0.1;

                    if(DEBUG_MODE) {
                        console.log(`[AnimateAlongGeneratedPath] Animating segment ${segmentIndex}: ${VectorToString(startPoint.position)} -> ${VectorToString(endPoint.position)} (${segmentDistance.toFixed(2)} units, ${segmentDuration.toFixed(3)}s, buffer: ${pointBuffer.length})`);
                    }

                    // Calculate rotation if needed
                    let rotation = ZERO_VEC;
                    if (options.rotateToDirection) {
                        rotation = this.CalculateRotationFromDirection(
                            Math2.Vec3.FromVector(endPoint.position)
                                .Subtract(Math2.Vec3.FromVector(startPoint.position))
                                .ToVector()
                        );
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
                if(DEBUG_MODE) {
                    console.log(`[AnimateAlongGeneratedPath] Animating through ${pointBuffer.length} remaining buffered points`);
                }
                
                // Animate through all remaining points in buffer
                while (pointBuffer.length > 0) {
                    const startPoint = pointBuffer.shift()!;
                    
                    // If there's a next point, animate to it; otherwise we're at the last point
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
            mod.StopActiveMovementForObject(animation.object);
        }
        this.activeAnimations.clear();
    }
}

// Global animation manager instance
const animationManager = new AnimationManager();


//==============================================================================================
// JSPLAYER CLASS
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

class JSPlayer {
    // Player game attributes
    readonly player: mod.Player;
    readonly playerId: number;
    score: PlayerScore;
    readonly joinOrder: number; // Track join order for team balancing
    heldFlags: Flag[] = [];

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
        
        // Create scoreboard UI for human players
        if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) {
            if (currentHUDClass) {
                this.scoreboardUI = new currentHUDClass(player);
            }
        }
        
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
// FLAG CLASS
//==============================================================================================

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
    
    // Timers
    dropTime: number = 0;
    autoReturnTime: number = 0;
    
    // Game objects
    flagRecoverIcon: mod.WorldIcon;
    flagCarriedIcons: Map<number, mod.WorldIcon> = new Map(); // One icon per opposing team
    flagInteractionPoint: mod.InteractPoint | null = null;
    flagProp: mod.Object | null = null;
    flagHomeVFX: mod.VFX;
    alarmSFX : mod.SFX | null = null;
    dragSFX: mod.SFX | null = null;
    tetherFlagVFX: mod.VFX | null = null;
    tetherPlayerVFX: mod.VFX | null = null;
    
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
        this.flagRecoverIcon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, ZERO_VEC, ZERO_VEC);
        this.flagProp = null;
        this.flagHomeVFX =  mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Smoke_Marker_Custom, this.homePosition, ZERO_VEC);       
        this.dragSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Levels_Brooklyn_Shared_Spots_MetalStress_OneShot3D, this.homePosition, ZERO_VEC);
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

        // If we're using an MCOM, disable it to hide the objective marker
        let mcom: mod.MCOM = this.flagProp as mod.MCOM;
        if(mcom)
            mod.EnableGameModeObjective(mcom, false);
        
        // Update defend icons for all opposing teams
        for (const [teamId, carriedIcon] of this.flagCarriedIcons.entries()) {
            mod.SetWorldIconColor(carriedIcon, GetTeamColor(this.team));
            mod.EnableWorldIconImage(carriedIcon, false);
            mod.SetWorldIconImage(carriedIcon, mod.WorldIconImages.Flag);
            mod.EnableWorldIconText(carriedIcon, false);
            mod.SetWorldIconText(carriedIcon, mod.Message(mod.stringkeys.pickup_flag_label));
        }

        // Update recover icon
        mod.SetWorldIconColor(this.flagRecoverIcon, GetTeamColor(this.team));
        mod.EnableWorldIconImage(this.flagRecoverIcon, false);
        mod.EnableWorldIconText(this.flagRecoverIcon, false);
        mod.SetWorldIconImage(this.flagRecoverIcon, mod.WorldIconImages.Flag);
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

        // Play VO voice lines
        this.PlayFlagTakenVO();

        // Play pickup SFX
        let pickupSfxOwner: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_EnemyPickedUpCache_OneShot2D, this.homePosition, ZERO_VEC);
        mod.PlaySound(pickupSfxOwner, 1, this.team);
        for(let teamID of GetOpposingTeamsForFlag(this)){
            let pickupSfxCapturer: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_FriendlyCapturedCache_OneShot2D, this.homePosition, ZERO_VEC);
            mod.PlaySound(pickupSfxCapturer, 1, mod.GetTeam(teamID));
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
    
    async DropFlag(position?: mod.Vector, direction?: mod.Vector, dropDistance: number = FLAG_DROP_DISTANCE, useProjectileThrow?: boolean): Promise<void> {
        if (!this.isBeingCarried) return;

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
        let flagRotation = mod.CreateVector(0, mod.ArctangentInRadians(mod.XComponentOf(direction) / mod.ZComponentOf(direction)), 0);
        
        // Initially spawn flag at carrier position - it will be moved by animation
        let initialPosition = position;
        
        if(!FLAG_FOLLOW_MODE){
            this.flagProp = mod.SpawnObject(FLAG_PROP, initialPosition, flagRotation);
        }

        if(DEBUG_MODE) console.log("this.flagProp = mod.SpawnObject(FLAG_PROP, initialPosition, flagRotation);");
        
        // If we're using an MCOM, disable it to hide the objective marker
        let mcom: mod.MCOM = this.flagProp as mod.MCOM;
        if(mcom)
            mod.EnableGameModeObjective(mcom, false);

        // Play yeet SFX
        let yeetSfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Soldier_Ragdoll_OnDeath_OneShot3D, initialPosition, ZERO_VEC);
        mod.PlaySound(yeetSfx, 1);

        // Clear the carrierPlayer when the flag has left the player
        this.carrierPlayer = null;

        // Animate flag with concurrent raycast generation
        if(this.flagProp && useProjectileThrow && !FLAG_FOLLOW_MODE) {
            if(DEBUG_MODE) console.log("Starting concurrent flag animation");
            
            // Create the generator for projectile path with validation callback
            const pathGenerator = RaycastManager.ProjectileRaycastGenerator(
                mod.Add(
                    mod.Add(position, mod.CreateVector(0.0, SOLDIER_HEIGHT, 0.0)),     // Start above soldier head to avoid self collisions
                    mod.Multiply(facingDir, 0.75)        // Start projectile arc away from player to avoid intersections
                ),
                throwDirectionAndSpeed,                 // Velocity
                FLAG_DROP_RAYCAST_DISTANCE,             // Max drop distance
                3,                                      // Sample rate
                this.carrierPlayer,                     // Origin player (now null but was set earlier)
                9.8,                                    // gravity
                DEBUG_MODE,                             // Debug visualization
                5,                                      // Interpolation steps
                async (hitPoint: mod.Vector, hitNormal?: mod.Vector) => {
                    // This callback is called when the projectile hits something
                    if(DEBUG_MODE) {
                        console.log(`[DropFlag] Hit detected at ${VectorToString(hitPoint)}, validating position`);
                    }
                    
                    // Move validation location slightly away from the hit location in direction of the hit normal
                    let groundLocationAdjusted: mod.Vector = mod.Add(
                        hitPoint, 
                        mod.Multiply(hitNormal ?? ZERO_VEC, SPAWN_VALIDATION_HEIGHT_OFFSET)
                    );
                    
                    // Adjust flag spawn location to make sure it's not clipping into a wall
                    const validatedFlagSpawn = await RaycastManager.ValidateSpawnLocationWithRadialCheck(
                        groundLocationAdjusted,             // Hit location, vertically adjusted upwards to avoid clipping into the ground plane
                        FLAG_COLLISION_RADIUS,              // Collision radius of the flag that is safe to spawn it in
                        FLAG_COLLISION_RADIUS_OFFSET,       // Offset to start rays from
                        SPAWN_VALIDATION_DIRECTIONS,        // How many direction rays to cast around the object
                        FLAG_DROP_RAYCAST_DISTANCE,         // How far down to look for a valid ground location
                        SPAWN_VALIDATION_MAX_ITERATIONS,    // Adjustment iterations, in case we don't find a valid location
                        DEBUG_MODE                          // Debug
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
                this.flagProp,
                pathGenerator,
                6,  // minBufferSize - stay 6 points ahead of animation to avoid catching up during validation
                {
                    speed: 800,
                    onProgress: (progress: number, position: mod.Vector) => {
                        mod.MoveVFX(this.flagHomeVFX, position, ZERO_VEC);
                    }
                }
            ).catch((reason: any) => {
                console.log(`Concurrent animation path failed with reason ${reason}`);
            });
            
            // Update current position to final animated position
            this.currentPosition = mod.GetObjectPosition(this.flagProp);
            
            if(DEBUG_MODE) console.log("Concurrent flag animation complete");
        } else if(!useProjectileThrow) {
            // Fallback: just set position directly
            this.currentPosition = position;
            if(this.flagProp) {
                mod.SetObjectTransform(this.flagProp, mod.CreateTransform(this.currentPosition, flagRotation));
            }
        }

        // Update the position of the flag interaction point
        this.UpdateFlagInteractionPoint();

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

        // Play drop SFX
        let dropSfxOwner: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_AltRecoveringCacheStart_OneShot2D, this.homePosition, ZERO_VEC);
        mod.PlaySound(dropSfxOwner, 1, this.team);
        // for(let teamID of GetOpposingTeamsForFlag(this)){
        //     let dropSfxCapturer: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_FriendlyCapturedCache_OneShot2D, this.homePosition, ZERO_VEC);
        //     mod.PlaySound(dropSfxCapturer, 1, mod.GetTeam(teamID));
        // }

        // Play drop VO
        let friendlyVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
        if(friendlyVO){
            mod.PlayVO(friendlyVO, mod.VoiceOverEvents2D.ObjectiveContested, mod.VoiceOverFlags.Alpha, this.team);
        }

        // Start timers
        this.StartAutoReturn(FLAG_AUTO_RETURN_TIME, this.numFlagTimesPickedUp).then( () => {console.log(`Flag ${this.teamId} auto-returning to base`)});
        this.StartPickupDelay().then(() => {console.log("Flag pickup delay expired")});
        
        if (DEBUG_MODE) {
            console.log(`Flag dropped`);
            mod.DisplayHighlightedWorldLogMessage(
                mod.Message(mod.stringkeys.flag_dropped, GetTeamName(this.team))
            );
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
        await mod.Wait(FLAG_PICKUP_DELAY);
        if (this.isDropped) {
            this.canBePickedUp = true;
        }
    }

    ReturnFlag(): void {
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.team_flag_returned));
        this.PlayFlagReturnedSFX();
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
            this.ReturnFlag();
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
        let soldierInVehicle = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsInVehicle);

        // Update jsPlayer velocity
        let jsPlayer = JSPlayer.get(this.carrierPlayer);
        if(jsPlayer){
            jsPlayer.velocity = currentVelocity
        }

        if(FLAG_FOLLOW_MODE){
            this.FollowPlayer(currentSoldierPosition);
        } else {
            this.currentPosition = currentSoldierPosition;
        }
        
        // Make smoke effect follow carrier
        mod.MoveVFX(this.flagHomeVFX, this.currentPosition, currentRotation);

        // Move carrier icons
        this.UpdateCarrierIcon();

        // Force disable carrier weapons
        this.CheckCarrierDroppedFlag(this.carrierPlayer);
    }

    FollowPlayer(currentSoldierPosition: mod.Vector) {
        let distanceToPlayer = Math2.Vec3.FromVector(currentSoldierPosition).Subtract(Math2.Vec3.FromVector(this.currentPosition)).Length();

        // Always add player position to buffer to maintain continuous path
        let currentFlagPos = Math2.Vec3.FromVector(this.currentPosition);
        let currentSoldierPos = Math2.Vec3.FromVector(currentSoldierPosition);
        let soldierToFlagDir = currentSoldierPos.Subtract(currentFlagPos);
        let soldierToFlagDirScaled = soldierToFlagDir.MultiplyScalar(0.85);
        let flagPositionScaled = currentFlagPos.Add(soldierToFlagDirScaled);
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
                let direction = Math2.Vec3.FromVector(nextPosition).Subtract(Math2.Vec3.FromVector(this.currentPosition)).MultiplyScalar(-1);
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
        // Move flag icons for all opposing teams
        let flagIconOffset = mod.Add(this.currentPosition, mod.CreateVector(0,2.5,0));
        for (const [teamId, carriedIcon] of this.flagCarriedIcons.entries()) {
            mod.SetWorldIconPosition(carriedIcon, flagIconOffset);
        }
        mod.SetWorldIconPosition(this.flagRecoverIcon, flagIconOffset);
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
    else if (playerTeamId === flag.teamId && flag.isDropped) {
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.team_flag_returned));
        flag.PlayFlagReturnedSFX();
        flag.ReturnFlag();
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
                mod.SetWorldIconImage(icon, mod.WorldIconImages.Triangle);
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

function GetDefaultFlagCaptureZoneAreaTriggerIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_CAPTURE_ZONE_ID_OFFSET;
}

function GetDefaultFlagCaptureZoneSpatialIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_CAPTURE_ZONE_ICON_ID_OFFSET;
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
            textLabel: "",
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
}

class ScoreTicker extends TickerWidget {
    readonly team: mod.Team;
    readonly teamId: number;
    
    private currentScore: number = -1;
    private isLeading: boolean = false;
    
    constructor(params: ScoreTickerParams) {
        // Get team colors before calling super
        const teamId = mod.GetObjId(params.team);
        const teamColor = GetTeamColorById(teamId);
        const textColor = VectorClampToRange(
            GetTeamColorLight(params.team), 
            0, 
            1
        );
        
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
            this.updateText(mod.Message(score));

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

        const textColor = VectorClampToRange(
            GetTeamColorLight(team), 
            0, 
            1
        );
        
        return new FlagBarTicker({
            position: [xPos, 0],
            size: [this.halfBarWidth, this.barHeight],
            parent: this.rootContainer,
            textSize: 0,  // No text
            textColor: textColor,
            bgColor: teamColor,
            bgAlpha: 0.5,
            showProgressBar: true,
            progressValue: 1.0,  // Start full
            progressDirection: isLeftSide ? 'right' : 'left'
        });
    }
    
    private createFlagIcon(team: mod.Team, teamId: number): FlagIcon {
        const teamColor = GetTeamColorById(teamId);
        
        return new FlagIcon({
            name: `FlagBar_FlagIcon_Team${teamId}`,
            position: mod.CreateVector(0, 0, 0),
            size: mod.CreateVector(this.flagIconSize[0], this.flagIconSize[1], 0),
            anchor: mod.UIAnchor.Center,
            parent: this.rootContainer,
            bgFill: mod.UIBgFill.Solid,
            fillColor: mod.Add(teamColor, mod.CreateVector(0.5, 0.5, 0.5)),
            fillAlpha: 1,
            outlineColor: teamColor,
            outlineThickness: 1,
            showFill: true,
            showOutline: true,
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
        
        // Update flag icon visibility based on flag state
        // FIXED: Show flag when NOT dropped (was reversed)
        if (flag.isDropped) {
            //if (DEBUG_MODE) console.log(`[FlagBar] Team ${flag.teamId} flag is DROPPED, setting alpha to 0.0`);
            flagIcon.SetFillAlpha(0.15);
            flagIcon.SetOutlineAlpha(0.75);           
        } else {
            //if (DEBUG_MODE) console.log(`[FlagBar] Team ${flag.teamId} flag is NOT dropped, setting alpha to 1.0`);
            flagIcon.SetFillAlpha(1);
            flagIcon.SetOutlineAlpha(1);
        }
        
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
     * Clean up all UI widgets
     */
    public destroy(): void {
        this.team1FlagIcon.Destroy();
        this.team2FlagIcon.Destroy();
        mod.DeleteUIWidget(this.rootContainer);
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
            size: mod.CreateVector(35, 35, 0),
            anchor: mod.UIAnchor.TopCenter,
            fillColor:  GetTeamColorById(this.teamId),
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
    
    /**
     * Update the team's score and flag status display
     */
    update(): void {
        // Update score ticker
        this.scoreTicker.updateScore();

        // Get flag status for this team
        const flag = flags.get(this.teamId);
        if(flag){
            const flagStatus = BuildFlagStatus(flag);
            
            // TODO: Ugly hack. This needs to be event triggered, not changed in update
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
    
    /**
     * Set whether this team is currently in the lead
     */
    setLeading(isLeading: boolean): void {
        this.scoreTicker.setLeading(isLeading);
    }
}

/**
 * ScoreboardUI - Main scoring interface for CTF
 * Shows player's team and all team scores with flag statuses
 */
class MultiTeamScoreHUD implements BaseScoreboardHUD {
    readonly player: mod.Player;
    readonly playerId: number;
    
    rootWidget: mod.UIWidget | undefined;
    private teamIndicatorContainer: mod.UIWidget | undefined;
    private teamIndicatorText: mod.UIWidget | undefined;
    private teamRow: mod.UIWidget | undefined;
    private teamColumns: Map<number, TeamColumnWidget> = new Map();
    
    private readonly ROOT_WIDTH = 700;
    private readonly ROOT_HEIGHT = 100;
    private readonly TOP_PADDING = 67;
    private readonly TEAM_INDICATOR_HEIGHT = 25;
    private readonly COLUMN_SPACING = 40;
    
    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        this.create();
    }
    
    create(): void {
        if (this.rootWidget) return;
        
        // Calculate total width needed based on team count
        const teamCount = teams.size;
        const columnWidth = 60; // Must match TeamColumnWidget.COLUMN_WIDTH
        const totalColumnsWidth = (teamCount * columnWidth) + ((teamCount - 1) * this.COLUMN_SPACING);
        const actualRootWidth = totalColumnsWidth;//Math.max(this.ROOT_WIDTH, totalColumnsWidth + 40); // 40px padding
        
        // Create root container
        this.rootWidget = modlib.ParseUI({
            type: "Container",
            size: [actualRootWidth, this.ROOT_HEIGHT],
            position: [0, this.TOP_PADDING],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0,
            playerId: this.player
        })!;

        // Create team indicator (Row 1)
        this.teamIndicatorContainer = modlib.ParseUI({
            type: "Container",
            parent: this.rootWidget,
            position: [0, 0],
            size: [actualRootWidth, this.TEAM_INDICATOR_HEIGHT],
            anchor: mod.UIAnchor.TopCenter,
            //bgFill: mod.UIBgFill.Blur,
            bgColor: GetTeamColor(mod.GetTeam(this.player)),
            bgAlpha: 0.5
        })!;
        
        // Create team indicator (Row 1)
        this.teamIndicatorText = modlib.ParseUI({
            type: "Text",
            parent: this.teamIndicatorContainer,
            position: [0, 2],
            size: [actualRootWidth, this.TEAM_INDICATOR_HEIGHT],
            anchor: mod.UIAnchor.TopCenter,
            textAnchor: mod.UIAnchor.Center,
            textSize: 20,
            textLabel: mod.Message(mod.stringkeys.scoreUI_team_label, GetTeamName(mod.GetTeam(this.player))),
            textColor: [1, 1, 1],
            bgAlpha: 0
        })!;
        
        this.teamRow = modlib.ParseUI({
            type: "Container",
            parent: this.rootWidget,
            size: [actualRootWidth, this.TEAM_INDICATOR_HEIGHT],
            position: [0, this.TEAM_INDICATOR_HEIGHT + 8],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.None,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0,
            playerId: this.player
        })!;
        
        // Create team columns (Row 2)
        const columnsStartY = 0;
        
        // Calculate starting X position for the first widget's CENTER point
        // Start at left edge of group (-totalColumnsWidth/2) then offset by half a column width
        let currentX = -(totalColumnsWidth / 2) + (columnWidth / 2);
        
        for (const [teamId, team] of teams.entries()) {
            let isPlayerTeam: boolean = mod.Equals(team, mod.GetTeam(this.player));
            const columnPos = [currentX, 0];
            const column = new TeamColumnWidget(team, columnPos, [50, 30], this.teamRow, isPlayerTeam);
            this.teamColumns.set(teamId, column);
            currentX += columnWidth + this.COLUMN_SPACING;
        }

        // Update root widget width now that we have the total column width
        mod.SetUIWidgetSize(this.rootWidget, mod.CreateVector(totalColumnsWidth, this.ROOT_HEIGHT, 0));
        this.rootWidget
        
        // Initial refresh
        this.refresh();
    }
    
    /**
     * Update all UI elements with current game state
     */
    refresh(): void {
        if (!this.rootWidget || !this.teamIndicatorContainer || !this.teamIndicatorText) return;
        
        // Update team indicator text with player's current team
        const playerTeam = mod.GetTeam(this.player);
        const playerTeamId = mod.GetObjId(playerTeam);
        const teamName = GetTeamName(playerTeam);
        const teamColor = GetTeamColor(playerTeam);
        
        mod.SetUITextLabel(this.teamIndicatorText, mod.Message(mod.stringkeys.scoreUI_team_label, teamName));
        mod.SetUITextColor(this.teamIndicatorText, mod.CreateVector(1,1,1));
        mod.SetUIWidgetBgColor(this.teamIndicatorContainer, teamColor);
        
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
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, false);
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

import { ParseUI } from "modlib";

/**
 * ScoreboardUI - Main scoring interface for CTF
 * Shows player's team and all team scores with flag statuses
 */
class ClassicCTFScoreHUD implements BaseScoreboardHUD{
    readonly player: mod.Player;
    readonly playerId: number;
    
    rootWidget: mod.UIWidget | undefined;

    // Team scores
    teamScoreTickers: Map<number, ScoreTicker> = new Map<number, ScoreTicker>();
    teamScoreSpacing: number = 490;
    teamScorePaddingTop: number = 64;
    teamWidgetSize: number[] = [76, 30];

    // Round timer
    timerTicker: RoundTimer | undefined;
    timerWidgetSize: number[] = [66, 20];
    timerScorePaddingTop: number = 86;

    // Flag bar
    flagBar: FlagBar | undefined;
    flagBarPadding = 20;
    flagBarHeight = 12;

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        this.create();
    }
    
    create(): void {
        if (this.rootWidget) return;
        
        // Create root container
        this.rootWidget = modlib.ParseUI({
            type: "Container",
            size: [700, 100],
            position: [0, 0],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0,
            playerId: this.player
        })!;

        // Create team score tickers
        for (const [teamId, team] of teams.entries()) {
            let tickerParams: ScoreTickerParams = {
                parent: this.rootWidget,
                position: [((teamId - 1) * this.teamScoreSpacing) - this.teamScoreSpacing*0.5, this.teamScorePaddingTop],
                size: this.teamWidgetSize,
                team: team
            };
            this.teamScoreTickers.set(teamId, new ScoreTicker(tickerParams));
        }

        // Create flag bar (positioned between the two score tickers)
        const team1Ticker = this.teamScoreTickers.get(1);
        const team2Ticker = this.teamScoreTickers.get(2);
        
        if (team1Ticker && team2Ticker && team1 && team2) {
            // Calculate FlagBar dimensions and position
            const barWidth = this.teamScoreSpacing - this.teamWidgetSize[0] - this.flagBarPadding;
            const barPosX = 0;  // Center horizontally
            const barPosY = this.teamScorePaddingTop + (this.teamWidgetSize[1] / 2) - (this.flagBarHeight * 0.5);
            
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

        this.timerTicker = new RoundTimer({
            position: [0, this.timerScorePaddingTop],
            parent: this.rootWidget,
            textSize: 24,
            size: this.timerWidgetSize,
        })!;

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
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, false);
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
    
    // Flag proportions
    private readonly POLE_WIDTH_RATIO = 0.15;
    private readonly POLE_HEIGHT_RATIO = 1.0;
    private readonly FLAG_WIDTH_RATIO = 0.85;
    private readonly FLAG_HEIGHT_RATIO = 0.55;
    
    constructor(params: FlagIconParams) {
        this.params = params;
        
        // Default values
        this.params.showFill = params.showFill ?? true;
        this.params.showOutline = params.showOutline ?? false;
        this.params.fillColor = VectorClampToRange(params.fillColor ?? mod.CreateVector(1, 1, 1), 0, 1);
        this.params.fillAlpha = params.fillAlpha ?? 1.0;
        this.params.outlineColor = VectorClampToRange(params.outlineColor ?? mod.CreateVector(1, 1, 1), 0, 1);
        this.params.outlineAlpha = params.outlineAlpha ?? 1.0;
        this.params.flagPoleGap = params.flagPoleGap ?? 2.0;
        
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
    HUDClass?: new (player: mod.Player) => BaseScoreboardHUD;
}

// Store the HUD class to use for player scoreboards
let currentHUDClass: (new (player: mod.Player) => BaseScoreboardHUD) | undefined;

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

