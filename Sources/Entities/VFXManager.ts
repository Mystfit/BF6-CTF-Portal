//==============================================================================================
// VFX MANAGER - Centralized management of ongoing VFX with refresh support
//==============================================================================================

/**
 * Type for runtime spawnable objects (VFX, SFX, etc.)
 */
type RuntimeSpawnType =
    | mod.RuntimeSpawn_Common
    | mod.RuntimeSpawn_Abbasid
    | mod.RuntimeSpawn_Aftermath
    | mod.RuntimeSpawn_Battery
    | mod.RuntimeSpawn_Capstone
    | mod.RuntimeSpawn_Dumbo
    | mod.RuntimeSpawn_FireStorm
    | mod.RuntimeSpawn_Limestone
    | mod.RuntimeSpawn_Outskirts
    | mod.RuntimeSpawn_Tungsten;

/**
 * Saved state for a VFX to enable refresh with same properties
 */
interface VFXState {
    id: string;
    vfxType: RuntimeSpawnType; // RuntimeSpawn VFX type for respawning if needed
    position: mod.Vector;
    rotation: mod.Vector;
    color?: mod.Vector;
    enabled: boolean;
    scale?: number;
}

/**
 * VFXManager - Manages all ongoing VFX effects in the game
 * Handles refresh on player first deploy by toggling VFX visibility
 *
 * Features:
 * - Automatic state tracking
 * - Toggle-based refresh (preserves particles)
 * - Centralized VFX lifecycle management
 * - Position, rotation, color, and scale tracking
 */
class VFXManager {
    private static instance: VFXManager;
    private vfxObjects: Map<string, mod.VFX> = new Map();
    private vfxStates: Map<string, VFXState> = new Map();

    private constructor() {
        if (DEBUG_MODE) {
            console.log('VFXManager: Initialized');
        }
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): VFXManager {
        if (!VFXManager.instance) {
            VFXManager.instance = new VFXManager();
        }
        return VFXManager.instance;
    }

    /**
     * Create and register a VFX effect
     * @param id Unique identifier for this VFX
     * @param vfxType RuntimeSpawn VFX type (e.g., mod.RuntimeSpawn_Common.FX_Smoke_Marker_Custom)
     * @param position World position
     * @param rotation World rotation (Euler angles as Vector)
     * @param options Optional configuration
     */
    createVFX(
        id: string,
        vfxType: RuntimeSpawnType,
        position: mod.Vector,
        rotation: mod.Vector,
        options?: {
            color?: mod.Vector;
            enabled?: boolean;
            scale?: number;
        }
    ): mod.VFX {
        // Delete existing VFX if it exists
        if (this.vfxObjects.has(id)) {
            this.deleteVFX(id);
        }

        // Spawn the VFX
        const vfx = mod.SpawnObject(vfxType, position, rotation) as mod.VFX;

        // Apply color if specified
        if (options?.color !== undefined) {
            mod.SetVFXColor(vfx, options.color);
        }

        // Apply scale if specified
        if (options?.scale !== undefined) {
            mod.SetVFXScale(vfx, options.scale);
        }

        // Apply enabled state (default to true)
        const enabled = options?.enabled ?? true;
        mod.EnableVFX(vfx, enabled);

        // Save state
        const state: VFXState = {
            id: id,
            vfxType: vfxType,
            position: position,
            rotation: rotation,
            color: options?.color,
            enabled: enabled,
            scale: options?.scale
        };

        this.vfxObjects.set(id, vfx);
        this.vfxStates.set(id, state);

        if (DEBUG_MODE) {
            console.log(`VFXManager: Created VFX '${id}'`);
        }

        return vfx;
    }

    /**
     * Get a managed VFX by ID
     */
    getVFX(id: string): mod.VFX | undefined {
        return this.vfxObjects.get(id);
    }

    /**
     * Update VFX position and rotation, and save state
     */
    setPosition(id: string, position: mod.Vector, rotation: mod.Vector): void {
        const vfx = this.vfxObjects.get(id);
        const state = this.vfxStates.get(id);

        if (vfx && state) {
            mod.MoveVFX(vfx, position, rotation);
            state.position = position;
            state.rotation = rotation;
        }
    }

    /**
     * Update VFX color and save state
     */
    setColor(id: string, color: mod.Vector): void {
        const vfx = this.vfxObjects.get(id);
        const state = this.vfxStates.get(id);

        if (vfx && state) {
            mod.SetVFXColor(vfx, color);
            state.color = color;
        }
    }

    /**
     * Update VFX enabled state and save state
     */
    setEnabled(id: string, enabled: boolean): void {
        const vfx = this.vfxObjects.get(id);
        const state = this.vfxStates.get(id);

        if (vfx && state) {
            mod.EnableVFX(vfx, enabled);
            state.enabled = enabled;
        }
    }

    /**
     * Update VFX scale and save state
     */
    setScale(id: string, scale: number): void {
        const vfx = this.vfxObjects.get(id);
        const state = this.vfxStates.get(id);

        if (vfx && state) {
            mod.SetVFXScale(vfx, scale);
            state.scale = scale;
        }
    }

    /**
     * Delete a specific VFX
     */
    deleteVFX(id: string): void {
        const vfx = this.vfxObjects.get(id);
        if (vfx) {
            mod.UnspawnObject(vfx);
            this.vfxObjects.delete(id);
            this.vfxStates.delete(id);

            if (DEBUG_MODE) {
                console.log(`VFXManager: Deleted VFX '${id}'`);
            }
        }
    }

    /**
     * Refresh a specific VFX using toggle method
     * Disables then re-enables to force visibility update without destroying particles
     */
    private refreshVFX(id: string): void {
        const vfx = this.vfxObjects.get(id);
        const state = this.vfxStates.get(id);

        if (!vfx || !state) return;

        // Toggle method: disable then re-enable with saved state
        // This should preserve particle state while forcing visibility refresh
        mod.EnableVFX(vfx, false);
        mod.EnableVFX(vfx, state.enabled);

        if (DEBUG_MODE) {
            console.log(`VFXManager: Refreshed VFX '${id}' (toggled ${state.enabled ? 'on' : 'off'})`);
        }
    }

    /**
     * Refresh all managed VFX effects
     * Called when a player deploys for the first time to fix visibility bugs
     */
    refreshAllVFX(): void {
        if (DEBUG_MODE) {
            console.log(`VFXManager: Refreshing ${this.vfxStates.size} VFX effects`);
        }

        for (const id of this.vfxStates.keys()) {
            this.refreshVFX(id);
        }
    }

    /**
     * Delete all managed VFX
     */
    deleteAllVFX(): void {
        for (const vfx of this.vfxObjects.values()) {
            mod.UnspawnObject(vfx);
        }
        this.vfxObjects.clear();
        this.vfxStates.clear();

        if (DEBUG_MODE) {
            console.log('VFXManager: Deleted all VFX');
        }
    }

    /**
     * Get count of managed VFX
     */
    getVFXCount(): number {
        return this.vfxObjects.size;
    }

    /**
     * Check if a VFX exists
     */
    hasVFX(id: string): boolean {
        return this.vfxObjects.has(id);
    }
}
