//==============================================================================================
// MULTI 2+ TEAM CTF HUD
//==============================================================================================

/**
 * Get the text representation of a flag's current status
 * @param flag The flag to get status for
 * @returns Status message: "(  )" for home, "<  >" for carried, "[  ]" for dropped
 */
function BuildFlagStatus(flag: Flag): mod.Message {
    if (flag.isAtHome) return mod.Message(mod.stringkeys.scoreUI_flag_status_home);
    if (flag.isBeingCarried) return mod.Message(mod.stringkeys.scoreUI_flag_status_carried);
    if (flag.isDropped) return mod.Message(mod.stringkeys.scoreUI_flag_status_dropped);
    return mod.Message(mod.stringkeys.scoreUI_flag_status_home); // Default to home
}

/**
 * TeamColumnWidget - Displays a single team's score and flag status
 * Encapsulates the score ticker and flag icon
 */
class TeamColumnWidget {
    readonly teamId: number;
    readonly team: mod.Team;
    readonly isPlayerTeam: boolean;
    readonly scoreTicker: ScoreTicker;
    readonly flagIcon: FlagIcon;
    readonly verticalPadding:number = 8;
    
    constructor(team: mod.Team, position: number[], size: number[], parent: mod.UIWidget, isPlayerTeam:boolean) {
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.isPlayerTeam = isPlayerTeam;
        
        // Create score ticker with bracket indicators
        this.scoreTicker = new ScoreTicker({
            team: team,
            position: position,
            size: size,
            parent: parent,
            textSize: 28,
            bracketTopBottomLength: 10,
            bracketThickness: 3
        });

        // Create flag icon below the score ticker
        let flagIconConfig: FlagIconParams = {
            name: `FlagHomeIcon_Team${this.teamId}`,
            parent: parent,
            position: mod.CreateVector(position[0], position[1] + size[1] + this.verticalPadding, 0),
            size: mod.CreateVector(35, 35, 0),
            anchor: mod.UIAnchor.TopCenter,
            fillColor:  GetTeamColorById(this.teamId),
            fillAlpha: 1,
            outlineColor: GetTeamColorById(this.teamId),
            outlineAlpha: 1,
            showFill: true,
            showOutline: true,
            bgFill: mod.UIBgFill.Solid,
            outlineThickness: 0
        };
        this.flagIcon = new FlagIcon(flagIconConfig);
    }
    
    /**
     * Update the team's score and flag status display
     */
    update(): void {
        // Update score ticker
        this.scoreTicker.updateScore();

        // Get flag status for this team
        const flag = flags.get(this.teamId);
        if(flag){
            const flagStatus = BuildFlagStatus(flag);
            
            // TODO: Ugly hack. This needs to be event triggered, not changed in update
            if(flag.isAtHome){
                this.flagIcon.SetVisible(true);
                this.flagIcon.SetFillAlpha(1);
                this.flagIcon.SetOutlineAlpha(1);
            } else if(flag.isBeingCarried){
                this.flagIcon.SetVisible(false);
            } else if(flag.isDropped){
                this.flagIcon.SetVisible(true);
                this.flagIcon.SetFillAlpha(0.15);
                this.flagIcon.SetOutlineAlpha(0.75);
            }
        }
    }
    
    /**
     * Set whether this team is currently in the lead
     */
    setLeading(isLeading: boolean): void {
        this.scoreTicker.setLeading(isLeading);
    }
}

/**
 * ScoreboardUI - Main scoring interface for CTF
 * Shows player's team and all team scores with flag statuses
 */
class MultiTeamScoreHUD implements BaseScoreboardHUD {
    readonly player: mod.Player;
    readonly playerId: number;
    
    rootWidget: mod.UIWidget | undefined;
    private teamIndicatorContainer: mod.UIWidget | undefined;
    private teamIndicatorText: mod.UIWidget | undefined;
    private teamRow: mod.UIWidget | undefined;
    private teamColumns: Map<number, TeamColumnWidget> = new Map();
    
    private readonly ROOT_WIDTH = 700;
    private readonly ROOT_HEIGHT = 100;
    private readonly TOP_PADDING = 67;
    private readonly TEAM_INDICATOR_HEIGHT = 25;
    private readonly COLUMN_SPACING = 40;
    
    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        this.create();
    }
    
    create(): void {
        if (this.rootWidget) return;
        
        // Calculate total width needed based on team count
        const teamCount = teams.size;
        const columnWidth = 60; // Must match TeamColumnWidget.COLUMN_WIDTH
        const totalColumnsWidth = (teamCount * columnWidth) + ((teamCount - 1) * this.COLUMN_SPACING);
        const actualRootWidth = totalColumnsWidth;//Math.max(this.ROOT_WIDTH, totalColumnsWidth + 40); // 40px padding
        
        // Create root container
        this.rootWidget = modlib.ParseUI({
            type: "Container",
            size: [actualRootWidth, this.ROOT_HEIGHT],
            position: [0, this.TOP_PADDING],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0,
            playerId: this.player
        })!;

        // Create team indicator (Row 1)
        this.teamIndicatorContainer = modlib.ParseUI({
            type: "Container",
            parent: this.rootWidget,
            position: [0, 0],
            size: [actualRootWidth, this.TEAM_INDICATOR_HEIGHT],
            anchor: mod.UIAnchor.TopCenter,
            //bgFill: mod.UIBgFill.Blur,
            bgColor: GetTeamColor(mod.GetTeam(this.player)),
            bgAlpha: 0.5
        })!;
        
        // Create team indicator (Row 1)
        this.teamIndicatorText = modlib.ParseUI({
            type: "Text",
            parent: this.teamIndicatorContainer,
            position: [0, 2],
            size: [actualRootWidth, this.TEAM_INDICATOR_HEIGHT],
            anchor: mod.UIAnchor.TopCenter,
            textAnchor: mod.UIAnchor.Center,
            textSize: 20,
            textLabel: mod.Message(mod.stringkeys.scoreUI_team_label, GetTeamName(mod.GetTeam(this.player))),
            textColor: [1, 1, 1],
            bgAlpha: 0
        })!;
        
        this.teamRow = modlib.ParseUI({
            type: "Container",
            parent: this.rootWidget,
            size: [actualRootWidth, this.TEAM_INDICATOR_HEIGHT],
            position: [0, this.TEAM_INDICATOR_HEIGHT + 8],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.None,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0,
            playerId: this.player
        })!;
        
        // Create team columns (Row 2)
        const columnsStartY = 0;
        
        // Calculate starting X position for the first widget's CENTER point
        // Start at left edge of group (-totalColumnsWidth/2) then offset by half a column width
        let currentX = -(totalColumnsWidth / 2) + (columnWidth / 2);
        
        for (const [teamId, team] of teams.entries()) {
            let isPlayerTeam: boolean = mod.Equals(team, mod.GetTeam(this.player));
            const columnPos = [currentX, 0];
            const column = new TeamColumnWidget(team, columnPos, [50, 30], this.teamRow, isPlayerTeam);
            this.teamColumns.set(teamId, column);
            currentX += columnWidth + this.COLUMN_SPACING;
        }

        // Update root widget width now that we have the total column width
        mod.SetUIWidgetSize(this.rootWidget, mod.CreateVector(totalColumnsWidth, this.ROOT_HEIGHT, 0));
        this.rootWidget
        
        // Initial refresh
        this.refresh();
    }
    
    /**
     * Update all UI elements with current game state
     */
    refresh(): void {
        if (!this.rootWidget || !this.teamIndicatorContainer || !this.teamIndicatorText) return;
        
        // Update team indicator text with player's current team
        const playerTeam = mod.GetTeam(this.player);
        const playerTeamId = mod.GetObjId(playerTeam);
        const teamName = GetTeamName(playerTeam);
        const teamColor = GetTeamColor(playerTeam);
        
        mod.SetUITextLabel(this.teamIndicatorText, mod.Message(mod.stringkeys.scoreUI_team_label, teamName));
        mod.SetUITextColor(this.teamIndicatorText, mod.CreateVector(1,1,1));
        mod.SetUIWidgetBgColor(this.teamIndicatorContainer, teamColor);
        
        // Determine which team is leading (if any)
        let maxScore = -1;
        let leadingTeams: number[] = [];
        
        for (const [teamId, score] of teamScores.entries()) {
            if (score > maxScore) {
                maxScore = score;
                leadingTeams = [teamId];
            } else if (score === maxScore && score > 0) {
                leadingTeams.push(teamId);
            }
        }
        
        // Update each team column
        for (const [teamId, column] of this.teamColumns.entries()) {
            column.update();
            
            // Show brackets only if this team is the sole leader (no ties)
            const isLeading = leadingTeams.length === 1 && leadingTeams[0] === teamId;
            column.setLeading(isLeading);
        }
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
