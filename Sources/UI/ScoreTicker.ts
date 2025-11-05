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
}

class ScoreTicker extends TickerWidget {
    readonly team: mod.Team;
    readonly teamId: number;
    
    private currentScore: number = -1;
    private isLeading: boolean = false;
    
    constructor(params: ScoreTickerParams) {
        // Get team colors before calling super
        const teamId = mod.GetObjId(params.team);
        const teamColor = GetTeamColorById(teamId);
        const textColor = VectorClampToRange(
            GetTeamColorLight(params.team), 
            0, 
            1
        );
        
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
            this.updateText(mod.Message(score));

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
