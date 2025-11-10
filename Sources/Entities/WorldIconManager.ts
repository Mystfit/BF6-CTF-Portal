//==============================================================================================
// WORLD ICON MANAGER - Centralized management of WorldIcons with refresh support
//==============================================================================================

/**
 * Saved state for a WorldIcon to enable respawning with same properties
 */
interface WorldIconState {
    id: string;
    position: mod.Vector;
    text?: mod.Message;
    textEnabled: boolean;
    icon?: mod.WorldIconImages;
    iconEnabled: boolean;
    color?: mod.Vector;
    teamOwner?: mod.Team; // Team object for team scoping
    playerOwner?: mod.Player; // Player object for player scoping
}

/**
 * WorldIconManager - Manages all WorldIcons in the game
 * Handles refresh on player join by respawning icons with saved state
 *
 * Features:
 * - Automatic state tracking
 * - Respawn on player join (fixes visibility bug)
 * - Team/Player scoped icon support
 * - Centralized cleanup
 */
class WorldIconManager {
    private static instance: WorldIconManager;
    private icons: Map<string, mod.WorldIcon> = new Map();
    private iconStates: Map<string, WorldIconState> = new Map();

    private constructor() {
        if (DEBUG_MODE) {
            console.log('WorldIconManager: Initialized');
        }
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): WorldIconManager {
        if (!WorldIconManager.instance) {
            WorldIconManager.instance = new WorldIconManager();
        }
        return WorldIconManager.instance;
    }

    /**
     * Create and register a WorldIcon
     * @param id Unique identifier for this icon
     * @param position World position
     * @param options Optional configuration
     */
    createIcon(
        id: string,
        position: mod.Vector,
        options?: {
            text?: mod.Message;
            textEnabled?: boolean;
            icon?: mod.WorldIconImages;
            iconEnabled?: boolean;
            color?: mod.Vector;
            teamOwner?: mod.Team; // Team object for team scoping
            playerOwner?: mod.Player; // Player object for player scoping
        }
    ): mod.WorldIcon {
        // Delete existing icon if it exists
        if (this.icons.has(id)) {
            this.deleteIcon(id);
        }

        // Create the icon using the correct API
        const icon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, position, ZERO_VEC) as mod.WorldIcon;

        // Apply owner (team/player scope) if specified
        if (options?.teamOwner !== undefined) {
            mod.SetWorldIconOwner(icon, options.teamOwner);
        } else if (options?.playerOwner !== undefined) {
            mod.SetWorldIconOwner(icon, options.playerOwner);
        }

        // Apply text properties
        if (options?.text !== undefined) {
            mod.SetWorldIconText(icon, options.text);
        }
        const textEnabled = options?.textEnabled ?? false;
        mod.EnableWorldIconText(icon, textEnabled);

        // Apply icon properties
        if (options?.icon !== undefined) {
            mod.SetWorldIconImage(icon, options.icon);
        }
        const iconEnabled = options?.iconEnabled ?? false;
        mod.EnableWorldIconImage(icon, iconEnabled);

        // Apply color
        if (options?.color !== undefined) {
            mod.SetWorldIconColor(icon, options.color);
        }

        // Save state
        const state: WorldIconState = {
            id: id,
            position: position,
            text: options?.text,
            textEnabled: textEnabled,
            icon: options?.icon,
            iconEnabled: iconEnabled,
            color: options?.color,
            teamOwner: options?.teamOwner,
            playerOwner: options?.playerOwner
        };

        this.icons.set(id, icon);
        this.iconStates.set(id, state);

        if (DEBUG_MODE) {
            console.log(`WorldIconManager: Created icon '${id}'`);
        }

        return icon;
    }

    /**
     * Get a managed icon by ID
     */
    getIcon(id: string): mod.WorldIcon | undefined {
        return this.icons.get(id);
    }

    /**
     * Update icon position and save state
     */
    setPosition(id: string, position: mod.Vector): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconPosition(icon, position);
            state.position = position;
        }
    }

    /**
     * Update icon text and save state
     */
    setText(id: string, text: mod.Message): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconText(icon, text);
            state.text = text;
        }
    }

    /**
     * Update icon image and save state
     */
    setIcon(id: string, iconImage: mod.WorldIconImages): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconImage(icon, iconImage);
            state.icon = iconImage;
        }
    }

    /**
     * Update icon color and save state
     */
    setColor(id: string, color: mod.Vector): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconColor(icon, color);
            state.color = color;
        }
    }

    /**
     * Update icon text visibility and save state
     */
    setTextEnabled(id: string, enabled: boolean): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.EnableWorldIconText(icon, enabled);
            state.textEnabled = enabled;
        }
    }

    /**
     * Update icon image visibility and save state
     */
    setIconEnabled(id: string, enabled: boolean): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.EnableWorldIconImage(icon, enabled);
            state.iconEnabled = enabled;
        }
    }

    /**
     * Update both icon and text visibility together
     */
    setEnabled(id: string, iconEnabled: boolean, textEnabled: boolean): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.EnableWorldIconImage(icon, iconEnabled);
            mod.EnableWorldIconText(icon, textEnabled);
            state.iconEnabled = iconEnabled;
            state.textEnabled = textEnabled;
        }
    }

    /**
     * Update icon team owner and save state
     */
    setTeamOwner(id: string, team: mod.Team): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconOwner(icon, team);
            state.teamOwner = team;
            state.playerOwner = undefined; // Clear player owner
        }
    }

    /**
     * Update icon player owner and save state
     */
    setPlayerOwner(id: string, player: mod.Player): void {
        const icon = this.icons.get(id);
        const state = this.iconStates.get(id);

        if (icon && state) {
            mod.SetWorldIconOwner(icon, player);
            state.playerOwner = player;
            state.teamOwner = undefined; // Clear team owner
        }
    }

    /**
     * Delete a specific icon
     */
    deleteIcon(id: string): void {
        const icon = this.icons.get(id);
        if (icon) {
            mod.UnspawnObject(icon);
            this.icons.delete(id);
            this.iconStates.delete(id);

            if (DEBUG_MODE) {
                console.log(`WorldIconManager: Deleted icon '${id}'`);
            }
        }
    }

    /**
     * Refresh a specific icon (delete and recreate with saved state)
     * Called automatically on player join
     */
    private refreshIcon(id: string): void {
        const state = this.iconStates.get(id);
        if (!state) return;

        // Delete old icon
        const oldIcon = this.icons.get(id);
        if (oldIcon) {
            mod.UnspawnObject(oldIcon);
        }

        // Recreate with saved state using the correct API
        const newIcon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, state.position, ZERO_VEC) as mod.WorldIcon;

        // Reapply owner (team/player scope) first
        if (state.teamOwner !== undefined) {
            mod.SetWorldIconOwner(newIcon, state.teamOwner);
        } else if (state.playerOwner !== undefined) {
            mod.SetWorldIconOwner(newIcon, state.playerOwner);
        }

        // Reapply all saved properties
        if (state.text !== undefined) {
            mod.SetWorldIconText(newIcon, state.text);
        }
        mod.EnableWorldIconText(newIcon, state.textEnabled);

        if (state.icon !== undefined) {
            mod.SetWorldIconImage(newIcon, state.icon);
        }
        mod.EnableWorldIconImage(newIcon, state.iconEnabled);

        if (state.color !== undefined) {
            mod.SetWorldIconColor(newIcon, state.color);
        }

        // Update reference
        this.icons.set(id, newIcon);

        if (DEBUG_MODE) {
            console.log(`WorldIconManager: Refreshed icon '${id}'`);
        }
    }

    /**
     * Refresh all managed icons
     * Called when a player joins to fix visibility bugs
     */
    refreshAllIcons(): void {
        if (DEBUG_MODE) {
            console.log(`WorldIconManager: Refreshing ${this.iconStates.size} icons`);
        }

        for (const id of this.iconStates.keys()) {
            this.refreshIcon(id);
        }
    }

    /**
     * Delete all managed icons
     */
    deleteAllIcons(): void {
        for (const icon of this.icons.values()) {
            mod.UnspawnObject(icon);
        }
        this.icons.clear();
        this.iconStates.clear();

        if (DEBUG_MODE) {
            console.log('WorldIconManager: Deleted all icons');
        }
    }

    /**
     * Get count of managed icons
     */
    getIconCount(): number {
        return this.icons.size;
    }

    /**
     * Check if an icon exists
     */
    hasIcon(id: string): boolean {
        return this.icons.has(id);
    }
}
