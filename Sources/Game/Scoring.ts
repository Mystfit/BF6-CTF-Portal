//==============================================================================================
// SCORING AND RULES
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
        if(teams.size >= 3){
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
    GetCarriedFlags(scoringPlayer).forEach((flag:Flag) => {
        flag.events.emit("flagCaptured", {flag});
        flag.ResetFlag();
    });
    
    // Check win condition
    if (currentScore >= GAMEMODE_TARGET_SCORE) {
        EndGameByScore(scoringTeamId);
    }
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

async function CaptureFeedback(pos: mod.Vector): Promise<void> {
    let vfx: mod.VFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_BASE_Sparks_Pulse_L, pos, ZERO_VEC);
    let sfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_OnCapturedByFriendly_OneShot2D, pos, ZERO_VEC);
    mod.PlaySound(sfx, 1);
    mod.EnableVFX(vfx, true);

    // Cleanup
    mod.Wait(5);
    mod.UnspawnObject(sfx);
    mod.UnspawnObject(vfx);
}
