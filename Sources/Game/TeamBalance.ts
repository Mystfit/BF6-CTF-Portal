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
                // Reset team specific UI elements for this player
                jsPlayers[i].resetUI();
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