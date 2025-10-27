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
            size: [0, 0],
            position: [0, 0],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: [0, 0, 0],
            bgAlpha: 0.0,
            playerId: this.player
        })!;

        // Initial refresh
        this.refresh();
    }
    
    /**
     * Update all UI elements with current game state
     */
    refresh(): void {
        if (!this.rootWidget) return;
        
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
