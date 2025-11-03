//@ts-ignore
import * as modlib from 'modlib';

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

export function OnGameModeStarted() {
    console.log(`CTF Game Mode v${VERSION[0]}.${VERSION[1]}.${VERSION[2]} Started`);
    if(DEBUG_MODE)
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_version_started, VERSION[0], VERSION[1], VERSION[2]));

    // Initialize legacy team references (still needed for backwards compatibility)
    teamNeutral = mod.GetTeam(TeamID.TEAM_NEUTRAL);
    team1 = mod.GetTeam(TeamID.TEAM_1);
    team2 = mod.GetTeam(TeamID.TEAM_2);
    team3 = mod.GetTeam(TeamID.TEAM_3);
    team4 = mod.GetTeam(TeamID.TEAM_4);

    //await mod.Wait(1);

    // Load game mode configuration
    // let config = FourTeamCTFConfig;
    // LoadGameModeConfig(config);
    let activeConfig: GameModeConfig | undefined = undefined;
    for(let [configID, config] of DEFAULT_GAMEMODES){
        let gameModeConfigObj = mod.GetSpatialObject(configID);
        if(gameModeConfigObj){
            console.log(`currentModeId: ${configID}, gameModeConfigObj: ${gameModeConfigObj}, gameModeConfigId: ${configID}`);
            
            // Look up config from the map
            activeConfig = config
            if(activeConfig){
                console.log(`Found game mode with id ${configID}`);
            }
        }
    }
    
    if(activeConfig){
        LoadGameModeConfig(activeConfig);
    } else {
        console.log("Could not find a gamemode");
        return;
    }

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
    let jsPlayer = JSPlayer.get(eventPlayer);

    // Set up the player UI on spawn
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
    // If player was carrying a flag, drop it
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_died, eventPlayer));
    
    // Increment flag carrier kill score
    let killer = JSPlayer.get(eventOtherPlayer);
    if(killer){
        if(IsCarryingAnyFlag(eventPlayer) || WasCarryingAnyFlag(eventPlayer))
            killer.score.flag_carrier_kills += 1;
        else
            killer.score.kills += 1; 
    }

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
    if (IsCarryingAnyFlag(eventPlayer) && VEHICLE_BLOCK_CARRIER_DRIVING) {
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
    if (IsCarryingAnyFlag(eventPlayer) && VEHICLE_BLOCK_CARRIER_DRIVING) {      
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

function ForceToPassengerSeat(player: mod.Player, vehicle: mod.Vehicle): void {
    const seatCount = mod.GetVehicleSeatCount(vehicle);
    
    // Try to find an empty passenger seat
    let lastSeat = seatCount - 1;
    for (let i = seatCount-1; i >= VEHICLE_FIRST_PASSENGER_SEAT; --i) {
        if (!mod.IsVehicleSeatOccupied(vehicle, i)) {
            mod.ForcePlayerToSeat(player, vehicle, i);
            if (DEBUG_MODE) console.log(`Forced flag carrier to seat ${i}`);
            return;
        }
    }
    
    // Try last seat as fallback
    if (!mod.IsVehicleSeatOccupied(vehicle, lastSeat)) {
        mod.ForcePlayerToSeat(player, vehicle, lastSeat);
        if (DEBUG_MODE) console.log(`Forced flag carrier to seat ${lastSeat}`);
        return;
    }
    
    // No passenger seats available, force exit
    mod.ForcePlayerExitVehicle(player, vehicle);
    if (DEBUG_MODE) console.log("No passenger seats available, forcing exit");
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
