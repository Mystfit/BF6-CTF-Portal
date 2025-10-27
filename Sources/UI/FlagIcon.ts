//==============================================================================================
// FLAG ICON UI CLASS
//==============================================================================================

/**
 * FlagIcon - A custom UI widget that renders a flag icon using containers
 * 
 * Creates a flag icon composed of:
 * - A pole (vertical rectangle at the left)
 * - A flag (rectangle at the top)
 * 
 * Supports two rendering modes:
 * - Filled: Solid color fill (2 containers)
 * - Outline: Border-only rendering (6 containers)
 * 
 * Flag proportions (inspired by classic flag design):
 * - Pole: ~10% width, ~60% height (extends below flag)
 * - Flag: ~90% width, ~60% height (top portion only)
 */

interface FlagIconParams {
    name: string;
    position: mod.Vector;
    size: mod.Vector;           // Total flag size [width, height]
    anchor: mod.UIAnchor;
    parent: mod.UIWidget;
    visible?: boolean;
    color?: mod.Vector;         // Flag color (default: white)
    alpha?: number;             // Flag alpha (default: 1.0)
    outline?: boolean;          // Render as outline (default: false)
    outlineThickness?: number;  // Outline thickness in pixels (default: 2)
    teamId?: mod.Team;
    playerId?: mod.Player;
}

class FlagIcon {
    private rootContainer: mod.UIWidget;
    private poleContainer: mod.UIWidget;
    private flagContainers: mod.UIWidget[] = [];
    
    private readonly params: FlagIconParams;
    private isOutline: boolean;
    
    // Flag proportions
    private readonly POLE_WIDTH_RATIO = 0.1;
    private readonly POLE_HEIGHT_RATIO = 0.6;
    private readonly FLAG_WIDTH_RATIO = 0.9;
    private readonly FLAG_HEIGHT_RATIO = 0.6;
    
    constructor(params: FlagIconParams) {
        this.params = params;
        this.isOutline = params.outline ?? false;
        
        // Create root container
        this.rootContainer = this.createRootContainer();
        
        // Create flag components based on mode
        this.poleContainer = this.createPole();
        if (this.isOutline) {
            this.createOutlineFlag();
        } else {
            this.createFilledFlag();
        }
    }
    
    private createRootContainer(): mod.UIWidget {
        const root = modlib.ParseUI({
            type: "Container",
            name: this.params.name,
            position: this.params.position,
            size: this.params.size,
            anchor: this.params.anchor,
            parent: this.params.parent,
            visible: this.params.visible ?? true,
            bgAlpha: 0, // Transparent background
            teamId: this.params.teamId,
            playerId: this.params.playerId
        })!;
        
        return root;
    }
    
    private createPole(): mod.UIWidget {
        const totalWidth = mod.XComponentOf(this.params.size);
        const totalHeight = mod.YComponentOf(this.params.size);
        
        const poleWidth = totalWidth * this.POLE_WIDTH_RATIO;
        const poleHeight = totalHeight * this.POLE_HEIGHT_RATIO;
        
        // Position pole at bottom-left, extending down
        const poleX = 0;
        const poleY = totalHeight - poleHeight;
        
        const pole = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_pole`,
            position: [poleX, poleY],
            size: [poleWidth, poleHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: this.params.color ?? [1, 1, 1],
            bgAlpha: this.params.alpha ?? 1.0,
            bgFill: mod.UIBgFill.Solid,
            padding: 0
        })!;
        
        return pole;
    }
    
    private createFilledFlag(): void {
        const totalWidth = mod.XComponentOf(this.params.size);
        const totalHeight = mod.YComponentOf(this.params.size);
        
        const flagWidth = totalWidth * this.FLAG_WIDTH_RATIO;
        const flagHeight = totalHeight * this.FLAG_HEIGHT_RATIO;
        
        // Position flag at top-right
        const flagX = totalWidth - flagWidth;
        const flagY = 0;
        
        const flag = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_flag`,
            position: [flagX, flagY],
            size: [flagWidth, flagHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: this.params.color ?? [1, 1, 1],
            bgAlpha: this.params.alpha ?? 1.0,
            bgFill: mod.UIBgFill.Solid,
            padding: 0
        })!;
        
        this.flagContainers = [flag];
    }
    
    private createOutlineFlag(): void {
        const totalWidth = mod.XComponentOf(this.params.size);
        const totalHeight = mod.YComponentOf(this.params.size);
        const thickness = this.params.outlineThickness ?? 2;
        
        const flagWidth = totalWidth * this.FLAG_WIDTH_RATIO;
        const flagHeight = totalHeight * this.FLAG_HEIGHT_RATIO;
        const flagX = totalWidth - flagWidth;
        const flagY = 0;
        
        const color = this.params.color ?? [1, 1, 1];
        const alpha = this.params.alpha ?? 1.0;
        
        // Top border
        const topBorder = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_flag_top`,
            position: [flagX, flagY],
            size: [flagWidth, thickness],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: mod.UIBgFill.Solid,
            padding: 0
        })!;
        
        // Bottom border
        const bottomBorder = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_flag_bottom`,
            position: [flagX, flagY + flagHeight - thickness],
            size: [flagWidth, thickness],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: mod.UIBgFill.Solid,
            padding: 0
        })!;
        
        // Left border
        const leftBorder = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_flag_left`,
            position: [flagX, flagY],
            size: [thickness, flagHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: mod.UIBgFill.Solid,
            padding: 0
        })!;
        
        // Right border
        const rightBorder = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_flag_right`,
            position: [flagX + flagWidth - thickness, flagY],
            size: [thickness, flagHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: mod.UIBgFill.Solid,
            padding: 0
        })!;
        
        this.flagContainers = [topBorder, bottomBorder, leftBorder, rightBorder];
    }
    
    /**
     * Toggle between filled and outline rendering modes
     */
    ToggleOutline(): void {
        // Delete existing flag containers
        this.flagContainers.forEach(container => {
            mod.DeleteUIWidget(container);
        });
        this.flagContainers = [];
        
        // Toggle mode and recreate flag
        this.isOutline = !this.isOutline;
        
        if (this.isOutline) {
            this.createOutlineFlag();
        } else {
            this.createFilledFlag();
        }
    }
    
    /**
     * Update the flag color and optionally the alpha
     */
    SetColor(color: mod.Vector, alpha?: number): void {
        const newAlpha = alpha ?? this.params.alpha ?? 1.0;
        
        // Update pole
        mod.SetUIWidgetBgColor(this.poleContainer, color);
        mod.SetUIWidgetBgAlpha(this.poleContainer, newAlpha);
        
        // Update flag containers
        this.flagContainers.forEach(container => {
            mod.SetUIWidgetBgColor(container, color);
            mod.SetUIWidgetBgAlpha(container, newAlpha);
        });
        
        // Store new values
        this.params.color = color;
        this.params.alpha = newAlpha;
    }
    
    /**
     * Move the entire flag to a new position
     */
    SetPosition(position: mod.Vector): void {
        mod.SetUIWidgetPosition(this.rootContainer, position);
        this.params.position = position;
    }
    
    /**
     * Change the parent widget
     */
    SetParent(parent: mod.UIWidget): void {
        mod.SetUIWidgetParent(this.rootContainer, parent);
        this.params.parent = parent;
    }
    
    /**
     * Show or hide the flag
     */
    SetVisible(visible: boolean): void {
        mod.SetUIWidgetVisible(this.rootContainer, visible);
    }
    
    /**
     * Clean up all UI widgets
     */
    Destroy(): void {
        // Delete flag containers
        this.flagContainers.forEach(container => {
            mod.DeleteUIWidget(container);
        });
        
        // Delete pole
        mod.DeleteUIWidget(this.poleContainer);
        
        // Delete root container
        mod.DeleteUIWidget(this.rootContainer);
        
        this.flagContainers = [];
    }
    
    /**
     * Get the root container widget
     */
    GetRootWidget(): mod.UIWidget {
        return this.rootContainer;
    }
}