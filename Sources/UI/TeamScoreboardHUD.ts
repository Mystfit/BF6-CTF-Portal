//==============================================================================================
// TEAM SCOREBOARD HUD - Team-scoped widgets visible to all players on a team
//==============================================================================================

/**
 * TeamScoreboardHUD - Manages UI widgets that display team-specific information
 * Created once per team, visible to all players on that team.
 *
 * Contains:
 * - TeamOrdersBar (shows team-specific orders and flag events)
 */
class TeamScoreboardHUD {
    private static instances: Map<number, TeamScoreboardHUD> = new Map();

    readonly team: mod.Team;
    readonly teamId: number;
    readonly rootWidget: mod.UIWidget | undefined;
    private teamOrdersBar!: TeamOrdersBar;
    position: number[] = [0, 100];

    private constructor(team: mod.Team, position?: number[]) {
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.position = position ?? this.position;
        
        console.log(`Creating TeamScoreboardHUD for team ${this.teamId}`);

        // Create TEAM-SCOPED root container
        this.rootWidget = modlib.ParseUI({
            type: "Container",
            size: [400, 30],
            position:  this.position,
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0,
            teamId: team  // TEAM-SCOPED: visible to all players on this team
        })!;

        // Create TeamOrdersBar
        this.teamOrdersBar = new TeamOrdersBar(team, {
            position: [0, 0],
            size: [400, 30],
            parent: this.rootWidget,
            textSize: 22,
            bgAlpha: 0.5
        });

        if (DEBUG_MODE) {
            console.log(`TeamScoreboardHUD: Created team-scoped HUD for team ${this.teamId}`);
        }
    }

    /**
     * Create or get team HUD instance for a specific team
     */
    static create(team: mod.Team): TeamScoreboardHUD {
        const teamId = mod.GetObjId(team);

        let instance = TeamScoreboardHUD.instances.get(teamId);
        if (!instance) {
            instance = new TeamScoreboardHUD(team);
            TeamScoreboardHUD.instances.set(teamId, instance);
        }

        return instance;
    }

    /**
     * Get existing team HUD instance
     */
    static getInstance(teamId: number): TeamScoreboardHUD | undefined {
        return TeamScoreboardHUD.instances.get(teamId);
    }

    /**
     * Get all team HUD instances
     */
    static getAllInstances(): TeamScoreboardHUD[] {
        return Array.from(TeamScoreboardHUD.instances.values());
    }

    /**
     * Refresh the team-specific widgets
     */
    refresh(): void {
        this.teamOrdersBar.refresh();
    }

    /**
     * Close and cleanup team widgets
     */
    close(): void {
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, false);
        }

        this.teamOrdersBar.destroy();
    }

    /**
     * Check if this team HUD is open
     */
    isOpen(): boolean {
        return this.rootWidget !== undefined && mod.GetUIWidgetVisible(this.rootWidget);
    }

    /**
     * Reset all team HUD instances (for game restart)
     */
    static reset(): void {
        for (const instance of TeamScoreboardHUD.instances.values()) {
            instance.close();
        }
        TeamScoreboardHUD.instances.clear();
    }
}
