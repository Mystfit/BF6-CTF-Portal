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
