const ClassicCTFConfig: GameModeConfig = {
// Default 2-team CTF configuration for backwards compatibility
    teams: [
        { 
            teamId: TeamID.TEAM_1, 
            name: mod.stringkeys.purple_team_name, 
            color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_1), 
            hqId: TEAM1_HQ_ID, 
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
            hqId: TEAM2_HQ_ID,
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
