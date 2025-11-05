//==============================================================================================
// GLOBAL SCOREBOARD HUD - Manager for globally-scoped HUD instances
//==============================================================================================

/**
 * GlobalScoreboardHUD - Singleton manager that creates and manages global HUD instances
 *
 * This manager creates ONE instance of the appropriate HUD class (MultiTeamScoreHUD or ClassicCTFScoreHUD)
 * that is visible to ALL players (global scope).
 */
class GlobalScoreboardHUD {
    private static instance: GlobalScoreboardHUD | null = null;
    private globalHUD: BaseScoreboardHUD | null = null;

    private constructor() {
        // Private constructor for singleton
    }

    /**
     * Get or create the singleton instance
     */
    static getInstance(): GlobalScoreboardHUD {
        if (!GlobalScoreboardHUD.instance) {
            GlobalScoreboardHUD.instance = new GlobalScoreboardHUD();
        }
        return GlobalScoreboardHUD.instance;
    }

    /**
     * Initialize the global HUD based on the current game mode configuration
     * @param hudClass The HUD class to instantiate (must implement BaseScoreboardHUD)
     */
    createGlobalHUD(hudClass: new (player?: mod.Player) => BaseScoreboardHUD): void {
        if (this.globalHUD) {
            console.log("GlobalScoreboardHUD: Global HUD already exists, skipping creation");
            return;
        }

        // Create single global instance (no player parameter)
        this.globalHUD = new hudClass();

        if (DEBUG_MODE) {
            console.log(`GlobalScoreboardHUD: Created global ${hudClass.name} instance`);
        }
    }

    /**
     * Refresh the global HUD
     */
    refresh(): void {
        if (this.globalHUD) {
            this.globalHUD.refresh();
        }
    }

    /**
     * Close the global HUD
     */
    close(): void {
        if (this.globalHUD) {
            this.globalHUD.close();
            this.globalHUD = null;
        }
    }

    /**
     * Reset singleton instance (for game restart)
     */
    static reset(): void {
        if (GlobalScoreboardHUD.instance) {
            GlobalScoreboardHUD.instance.close();
            GlobalScoreboardHUD.instance = null;
        }
    }

    /**
     * Get the current global HUD instance
     */
    getHUD(): BaseScoreboardHUD | null {
        return this.globalHUD;
    }
}
