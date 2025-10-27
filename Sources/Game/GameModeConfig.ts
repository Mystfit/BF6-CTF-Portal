//==============================================================================================
// GAMEMODE CONFIGURATION AND LOADING 
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