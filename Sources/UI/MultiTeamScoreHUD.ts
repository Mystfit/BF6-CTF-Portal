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
    private eventUnsubscribers: (() => void)[] = [];

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
            size: mod.CreateVector(30, 30, 0),
            anchor: mod.UIAnchor.TopCenter,
            fillColor:  GetTeamColorById(this.teamId),
            fillAlpha: 1,
            outlineColor: GetTeamColorById(this.teamId),
            outlineAlpha: 1,
            showFill: true,
            showOutline: true,
            bgFill: mod.UIBgFill.Solid,
            outlineThickness: 1
        };
        this.flagIcon = new FlagIcon(flagIconConfig);

        // Subscribe to flag events
        this.bindFlagEvents();
    }

    /**
     * Subscribe to flag events for visual feedback
     */
    private bindFlagEvents(): void {
        const flag = flags.get(this.teamId);
        if (!flag) return;

        // Flag picked up - throb icon
        const unsubTaken = flag.events.on('flagTaken', (data) => {
            this.flagIcon.SetVisible(true);
            this.flagIcon.SetFillVisible(true);
            this.flagIcon.SetOutlineVisible(false);
            if (!this.flagIcon.isPulsing) {
                this.flagIcon.StartThrob(1, 0.15, 1);
            }
        });
        this.eventUnsubscribers.push(unsubTaken);

        // Flag dropped - show outline
        const unsubDropped = flag.events.on('flagDropped', (data) => {
            if (this.flagIcon.isPulsing) {
                this.flagIcon.StopThrob();
            }
            this.flagIcon.SetFillVisible(false);
            this.flagIcon.SetOutlineVisible(true);
            this.flagIcon.SetOutlineAlpha(1);
        });
        this.eventUnsubscribers.push(unsubDropped);

        // Flag returned - normal fill
        const unsubReturned = flag.events.on('flagReturned', (data) => {
            this.flagIcon.SetVisible(true);
            if (this.flagIcon.isPulsing) {
                this.flagIcon.StopThrob();
            }
            this.flagIcon.SetOutlineVisible(true);
            this.flagIcon.SetFillVisible(true);
            this.flagIcon.SetFillAlpha(1);
            this.flagIcon.SetOutlineAlpha(1);
        });
        this.eventUnsubscribers.push(unsubReturned);
    }
    
    /**
     * Update the team's score display
     */
    update(): void {
        // Update score ticker
        this.scoreTicker.updateScore();
        // Flag visual updates are now handled by event subscriptions
    }

    /**
     * Clean up event subscriptions
     */
    destroy(): void {
        // Unsubscribe from all flag events
        for (const unsubscribe of this.eventUnsubscribers) {
            unsubscribe();
        }
        this.eventUnsubscribers = [];
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
 * Shows all team scores with flag statuses
 *
 * GLOBAL SCOPE: Created once per game, visible to all players
 */
class MultiTeamScoreHUD implements BaseScoreboardHUD {
    readonly player: mod.Player;
    readonly playerId: number;

    rootWidget: mod.UIWidget | undefined;
    private teamRow: mod.UIWidget | undefined;
    private teamColumns: Map<number, TeamColumnWidget> = new Map();

    private readonly ROOT_WIDTH = 700;
    private readonly ROOT_HEIGHT = 110;
    private readonly TOP_PADDING = 47;
    private readonly COLUMN_SPACING = 40;

    constructor(player?: mod.Player) {
        // Player is optional - only used to satisfy BaseScoreboardHUD interface
        // This HUD is actually globally scoped
        this.player = (null as any);
        this.playerId = -1;
        this.create();
    }

    create(): void {
        if (this.rootWidget) return;

        // Calculate total width needed based on team count
        const teamCount = teams.size;
        const columnWidth = 60;
        const totalColumnsWidth = (teamCount * columnWidth) + ((teamCount - 1) * this.COLUMN_SPACING);

        // Create GLOBAL root container (NO playerId, NO teamId)
        this.rootWidget = modlib.ParseUI({
            type: "Container",
            size: [totalColumnsWidth, this.ROOT_HEIGHT],
            position: [0, 0],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0
            // NO playerId or teamId = GLOBAL SCOPE
        })!;

        // Create team row container
        this.teamRow = modlib.ParseUI({
            type: "Container",
            parent: this.rootWidget,
            size: [totalColumnsWidth, 50],
            position: [0, this.TOP_PADDING],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.None,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0
        })!;

        // Create team columns
        let currentX = -(totalColumnsWidth / 2) + (columnWidth / 2);

        for (const [teamId, team] of teams.entries()) {
            const columnPos = [currentX, 0];
            const column = new TeamColumnWidget(team, columnPos, [50, 30], this.teamRow, false);
            this.teamColumns.set(teamId, column);
            currentX += columnWidth + this.COLUMN_SPACING;
        }

        // Initial refresh
        this.refresh();
    }
    
    /**
     * Update all UI elements with current game state
     */
    refresh(): void {
        if (!this.rootWidget) return;

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
        // Destroy all child widgets first (bottom-up)

        // 1. Destroy all team column widgets
        for (const [teamId, column] of this.teamColumns.entries()) {
            column.destroy();  // Clean up event subscriptions
            column.scoreTicker.destroy();
            column.flagIcon.Destroy();
        }
        this.teamColumns.clear();

        // 2. Delete team row container
        if (this.teamRow) {
            mod.DeleteUIWidget(this.teamRow);
            this.teamRow = undefined;
        }

        // 3. Finally, hide and delete the root widget
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, false);
            mod.DeleteUIWidget(this.rootWidget);
            this.rootWidget = undefined;
        }
    }
    
    /**
     * Check if the scoreboard is currently visible
     */
    isOpen(): boolean {
        return this.rootWidget !== undefined;
    }
}
