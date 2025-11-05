//==============================================================================================
// PLAYER SCOREBOARD HUD - Player-scoped widgets visible only to specific player
//==============================================================================================

/**
 * PlayerScoreboardHUD - Manages UI widgets that display player-specific information
 * Created once per player, visible only to that player.
 *
 * Currently empty - reserved for future player-specific widgets.
 * TeamOrdersBar is in TeamScoreboardHUD (team-scoped) to avoid duplication.
 */
class PlayerScoreboardHUD implements BaseScoreboardHUD {
    readonly player: mod.Player;
    readonly playerId: number;
    rootWidget: mod.UIWidget | undefined;

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        this.create();
    }

    create(): void {
        if (this.rootWidget) return;

        // Create PLAYER-SCOPED root container (empty for now, ready for future widgets)
        const root = modlib.ParseUI({
            type: "Container",
            size: [400, 30],
            position: [0, 150],  // Position below team-scoped widgets
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.None,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0,
            playerId: this.player  // PLAYER-SCOPED: visible only to this player
        })!;

        this.rootWidget = root;

        if (DEBUG_MODE) {
            console.log(`PlayerScoreboardHUD: Created player-scoped HUD container for player ${this.playerId}`);
        }

        // Initial refresh
        this.refresh();
    }

    /**
     * Refresh the player-specific widgets
     */
    refresh(): void {
        if (!this.rootWidget) return;
        // No widgets to refresh yet
    }

    /**
     * Close and cleanup player widgets
     */
    close(): void {
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, false);
        }
        // No widgets to destroy yet
    }

    /**
     * Check if this player HUD is open
     */
    isOpen(): boolean {
        return this.rootWidget !== undefined && mod.GetUIWidgetVisible(this.rootWidget);
    }
}
