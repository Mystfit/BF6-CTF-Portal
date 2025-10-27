//==============================================================================================
// MULTI TEAM CTF CONFIG
//==============================================================================================

const FourTeamCTF: GameModeConfig = {
    teams: [
        { 
            teamId: 1, 
            name: mod.stringkeys.purple_team_name, 
            color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_1), 
            hqId: TEAM1_HQ_ID,
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
            hqId: TEAM2_HQ_ID,
            captureZones: [
                {
                    team: mod.GetTeam(TeamID.TEAM_2)  // Get team directly
                }
            ]
        },
        { teamId: 3, 
            name: mod.stringkeys.green_team_name, 
            color: DEFAULT_TEAM_COLOURS.get(TeamID.TEAM_3), 
            hqId: TEAM3_HQ_ID,
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
            hqId: TEAM4_HQ_ID,
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
