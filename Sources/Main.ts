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

// Global event dispatcher for player join/leave events
interface PlayerEventMap {
    'playerJoined': { player: mod.Player };
    'playerLeft': { playerId: number };
}
const globalPlayerEvents = new EventDispatcher<PlayerEventMap>();

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

// Global managers
let worldIconManager: WorldIconManager;
let vfxManager: VFXManager;


//==============================================================================================
// UI HIERARCHY INITIALIZATION
//==============================================================================================

/**
 * Position a team HUD below the global HUD
 * @param teamId The team ID to position the HUD for
 */
function PositionTeamHUD(teamId: number): void {
    // Get global HUD position and size
    let globalHUD = GlobalScoreboardHUD.getInstance().getHUD();
    if (!globalHUD?.rootWidget) return;

    let globalHUDPos = mod.GetUIWidgetPosition(globalHUD.rootWidget);
    let globalHUDSize = mod.GetUIWidgetSize(globalHUD.rootWidget);

    // Get team HUD instance
    let teamHUD = TeamScoreboardHUD.getInstance(teamId);
    if (!teamHUD?.rootWidget) return;

    // Calculate offset position below global HUD
    let teamHUDPos = mod.GetUIWidgetPosition(teamHUD.rootWidget);
    let offsetBarY = mod.YComponentOf(globalHUDPos) + mod.YComponentOf(globalHUDSize) + 10;

    // Apply position
    mod.SetUIWidgetPosition(
        teamHUD.rootWidget,
        mod.CreateVector(mod.XComponentOf(teamHUDPos), offsetBarY, 0)
    );

    if (DEBUG_MODE) {
        console.log(`Positioned team ${teamId} HUD at Y offset: ${offsetBarY}`);
    }
}

/**
 * Initialize the three-tier UI hierarchy:
 * 1. Global HUD (visible to all players)
 * 2. Team HUDs (visible to players on each team)
 * 3. Player HUDs (visible only to specific player) - created in JSPlayer.initUI()
 */
function InitializeUIHierarchy(): void {
    // 1. Create Global HUD (one instance for the entire game)
    const globalHUD = GlobalScoreboardHUD.getInstance();   
    if (currentHUDClass) {
        globalHUD.createGlobalHUD(currentHUDClass);
        if (DEBUG_MODE) {
            console.log(`InitializeUIHierarchy: Created global HUD with ${currentHUDClass.name}`);
        }
    }

    // 2. Create Team HUDs (one per team, not including neutral team)
    for (const [teamId, team] of teams.entries()) {
        if (teamId === 0) continue; // Skip neutral team

        TeamScoreboardHUD.create(team);
        PositionTeamHUD(teamId);

        if (DEBUG_MODE) {
            console.log(`InitializeUIHierarchy: Created team HUD for team ${teamId}`);
        }
    }

    // 3. Player HUDs are created individually in JSPlayer.initUI() when players spawn
    if (DEBUG_MODE) {
        console.log(`InitializeUIHierarchy: UI hierarchy initialized (Global + ${teams.size - 1} team HUDs)`);
    }
}

//==============================================================================================
// MAIN GAME LOOP
//==============================================================================================

export async function OnGameModeStarted() {
    console.log(`CTF Game Mode v${VERSION[0]}.${VERSION[1]}.${VERSION[2]} Started`);
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_version_author));
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.ctf_version_started, VERSION[0], VERSION[1], VERSION[2]));

    // Initialize global managers
    worldIconManager = WorldIconManager.getInstance();
    vfxManager = VFXManager.getInstance();

    // Initialize legacy team references (still needed for backwards compatibility)
    teamNeutral = mod.GetTeam(TeamID.TEAM_NEUTRAL);
    team1 = mod.GetTeam(TeamID.TEAM_1);
    team2 = mod.GetTeam(TeamID.TEAM_2);
    team3 = mod.GetTeam(TeamID.TEAM_3);
    team4 = mod.GetTeam(TeamID.TEAM_4);

    await mod.Wait(1);

    // Load game mode configuration
    // let config = FourTeamCTFConfig;
    // LoadGameModeConfig(config);
    let gameModeID = -1;
    let activeConfig: GameModeConfig | undefined = undefined;
    for(let [configID, config] of DEFAULT_GAMEMODES){
        let gameModeConfigObj = mod.GetSpatialObject(configID);
        let gameModeExistsFallbackPos = mod.GetObjectPosition(gameModeConfigObj);
        // Make sure the gameconfig object actually exists.
        // If the game mode config object has a zero vector, it doesn't exist
        let isAtOrigin = AreVectorsEqual(gameModeExistsFallbackPos, ZERO_VEC, 0.1);
        if(DEBUG_MODE)
            console.log(`currentModeId: ${configID}, gameModeConfigObj: ${gameModeConfigObj}, is at origin: ${isAtOrigin}, position: ${VectorToString(gameModeExistsFallbackPos)}`);
        
        if(gameModeConfigObj && !isAtOrigin){
            // Look up config from the map
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

    // Initialize UI hierarchy based on scope
    InitializeUIHierarchy();

    // Start update loops
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
        // console.log(`Fast tick delta ${timeDelta}`);

        // Update all flag carrier positions
        for (const [flagId, flag] of flags.entries()) {
            flag.FastUpdate(timeDelta);
        }

        // Refresh UI hierarchy:
        // 1. Global HUD (scores, timer, flags)
        GlobalScoreboardHUD.getInstance().refresh();

        // 2. Team HUDs (team orders) - refresh on events, not in tick loop

        // 3. Player HUDs (player-specific team orders)
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

        // Verify player is not driving
        // Fix for some vehicles not trigger events
        if(VEHICLE_BLOCK_CARRIER_DRIVING){
            JSPlayer.getAllAsArray().forEach((jsPlayer: JSPlayer) => {
                if (IsCarryingAnyFlag(jsPlayer.player)) {      
                    if (mod.GetPlayerVehicleSeat(jsPlayer.player) === VEHICLE_DRIVER_SEAT) {
                        if (DEBUG_MODE) console.log("Flag carrier in driver seat, forcing to passenger");
                        ForceToPassengerSeat(jsPlayer.player, mod.GetVehicleFromPlayer(jsPlayer.player));
                    }
                }
            });
        }

        lastSecondUpdateTime = currentTime;
    }
}


//==============================================================================================
// EVENT HANDLERS
//==============================================================================================

async function FixTeamScopedUIVisibility(player: mod.Player): Promise<void> {
    // WORKAROUND: Fix for team-scoped UI visibility bug
    // Tear down and rebuild the team UI for the player's team
    // This ensures team-scoped UIs become visible to the newly joined player

    const playerTeam = mod.GetTeam(player);
    const playerTeamId = mod.GetObjId(playerTeam);

    // Skip neutral team
    if (playerTeamId === 0) return;

    if (DEBUG_MODE) {
        console.log(`Rebuilding team UI for team ${playerTeamId} (player ${mod.GetObjId(player)} joined)`);
    }

    // Step 1: Destroy the existing team UI
    const existingHUD = TeamScoreboardHUD.getInstance(playerTeamId);
    if (existingHUD) {
        existingHUD.close();
    }

    // Step 2: Wait a frame for cleanup to complete
    //await mod.Wait(0);

    // Step 3: Recreate the team UI
    TeamScoreboardHUD.create(playerTeam);

    // Step 4: Reposition using shared function
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

    // Emit player joined event (for any other handlers that need it)
    globalPlayerEvents.emit('playerJoined', { player: eventPlayer });

    // Note: WorldIcon refresh and UI visibility fix now happens on first deploy, not on join
    // This prevents icons from disappearing when refreshed before player deploys

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

    // Check if this is the player's first deployment
    if (jsPlayer && !jsPlayer.hasEverDeployed) {
        jsPlayer.hasEverDeployed = true;

        if (DEBUG_MODE) {
            console.log(`Player ${mod.GetObjId(eventPlayer)} deployed for the first time - refreshing WorldIcons, VFX, and UI`);
        }

        // Refresh WorldIcons to fix visibility for this player
        // Small delay to ensure player is fully initialized before refreshing
        mod.Wait(0.1).then(() => {
            worldIconManager.refreshAllIcons();
        });

        // Refresh all VFX to fix visibility for this player
        vfxManager.refreshAllVFX();

        // Fix team-scoped UI visibility
        FixTeamScopedUIVisibility(eventPlayer);
    }

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
    if(DEBUG_MODE)
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
    if(DEBUG_MODE)
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.debug_player_enter_vehicle));

    // Check if player is carrying a flag
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
    // If player is carrying flag and in driver seat, force to passenger
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


//==============================================================================================
// GAME LOGIC FUNCTIONS
//==============================================================================================

async function ForceToPassengerSeat(player: mod.Player, vehicle: mod.Vehicle): Promise<void> {
    // Try to find an empty passenger seat
    const seatCount = mod.GetVehicleSeatCount(vehicle);
    let forcedToSeat = false;
    let lastSeat = seatCount - 1;
    let delayBeforeSwitch = TICK_RATE * 2;
    for (let i = seatCount-1; i >= VEHICLE_FIRST_PASSENGER_SEAT; --i) {
        if (!mod.IsVehicleSeatOccupied(vehicle, i)) {
            // Make sure we're not still in the OnPlayerEnteredVehicle event
            await mod.Wait(delayBeforeSwitch);

            mod.ForcePlayerToSeat(player, vehicle, i);
            forcedToSeat = true;
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.forced_to_seat), player);
            if (DEBUG_MODE) console.log(`Forced flag carrier to seat ${i}`);
            return;
        }
    }
    
    // Try last seat as fallback
    if (!mod.IsVehicleSeatOccupied(vehicle, lastSeat)) {
        // Make sure we're not still in the OnPlayerEnteredVehicle event
        await mod.Wait(delayBeforeSwitch);

        mod.ForcePlayerToSeat(player, vehicle, lastSeat);
        forcedToSeat = true;
        mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.forced_to_seat), player);
        if (DEBUG_MODE) console.log(`Forced flag carrier to seat ${lastSeat}`);
        return;
    }
    mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.no_passenger_seats, player));

    // Make sure we're not still in the OnPlayerEnteredVehicle event
    await mod.Wait(delayBeforeSwitch);
    
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
