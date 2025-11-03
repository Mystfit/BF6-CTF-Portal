//==============================================================================================
// CLASSIC 2-TEAM CTF HUD
//==============================================================================================

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
    teamScorePaddingTop: number = 68;
    teamWidgetSize: number[] = [76, 30];

    // Round timer
    timerTicker: RoundTimer | undefined;
    timerWidgetSize: number[] = [74, 22];
    timerScorePaddingTop: number = 48;
    teamOrdersPaddingTop: number = 100;

    // Flag bar
    flagBar: FlagBar | undefined;
    flagBarPadding = 20;
    flagBarHeight = 12;

    // Team order bar
    teamOrderBar: TeamOrdersBar | undefined;

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

        // Center flag bar positions
        const barWidth = this.teamScoreSpacing - this.teamWidgetSize[0] - this.flagBarPadding;
        const barPosX = 0;  // Center horizontally
        const barPosY = this.teamScorePaddingTop + (this.teamWidgetSize[1] / 2) - (this.flagBarHeight * 0.5);

        // Create flag bar (positioned between the two score tickers)
        const team1Ticker = this.teamScoreTickers.get(1);
        const team2Ticker = this.teamScoreTickers.get(2);

        if (team1Ticker && team2Ticker && team1 && team2) {
            // Calculate FlagBar dimensions and position
            
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

        // Create round timer
        this.timerTicker = new RoundTimer({
            position: [0, this.timerScorePaddingTop],
            parent: this.rootWidget,
            textSize: 26,
            size: this.timerWidgetSize,
            bgAlpha: 0.5,
            textColor: mod.CreateVector(0.9, 0.9, 0.9)
        })!;

        // Create team order bar
        this.teamOrderBar = new TeamOrdersBar(
            mod.GetTeam(this.player),
            {
                parent: this.rootWidget,
                position: [0, this.teamOrdersPaddingTop],
                size: [barWidth, 30],
                bgColor: GetTeamColor(mod.GetTeam(this.player)),
                textColor: GetTeamColorLight(mod.GetTeam(this.player)),
                textSize: 20,
            }
        )!;

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
