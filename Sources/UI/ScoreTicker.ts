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
    reversePulse?: boolean
}

class ScoreTicker extends TickerWidget {
    readonly team: mod.Team;
    readonly teamId: number;
    
    private currentScore: number = -1;
    private isLeading: boolean = false;
    private reversePulse: boolean = false;
    
    constructor(params: ScoreTickerParams) {
        // Get team colors before calling super
        const teamId = mod.GetObjId(params.team);
        const teamColor = GetTeamColorDark(params.team);
        const textColor = GetTeamColorLight(params.team);
        
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
        this.reversePulse = params.reversePulse ?? false;
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

            let pulseAndUpdateText = async () => {
                this.pulse(this.reversePulse);

                // Wait until pulse reaches text widget
                await mod.Wait(0.1625);
                this.updateText(mod.Message(score));

                // Set the text colour to white and fade back down
                let textColor: number[] = [mod.XComponentOf(this.textColor), mod.YComponentOf(this.textColor), mod.ZComponentOf(this.textColor)];
                await animationManager.AnimateValues([1, 1, 1], textColor, {
                    duration: 0.3,
                    easingFunction: Easing.EaseOutCubic,
                    onProgress: (values, normalizedTime) => {
                        mod.SetUITextColor(this.textWidget,  mod.CreateVector(values[0], values[1], values[2]));
                    }
                });
            };
            pulseAndUpdateText();

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

    /**
     * Destroy all UI widgets created by this score ticker
     */
    public destroy(): void {
        super.destroy();
    }
}
