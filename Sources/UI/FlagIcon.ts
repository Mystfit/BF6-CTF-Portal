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
    fillColor?: mod.Vector;         // Fill color (default: white)
    fillAlpha?: number;             // Fill alpha (default: 1.0)
    outlineColor?: mod.Vector;      // Outline color (default: white)
    outlineAlpha?: number;          // Outline alpha (default: 1.0)
    outlineThickness?: number;      // Outline thickness in pixels (default: 2)
    showFill?: boolean;             // Show filled version (default: true)
    showOutline?: boolean;          // Show outline version (default: false)
    teamId?: mod.Team;
    playerId?: mod.Player;
    bgFill?: mod.UIBgFill;
    flagPoleGap?: number;
}

class FlagIcon {
    private rootContainer: mod.UIWidget;
    private fillContainers: mod.UIWidget[] = [];     // Containers for filled version
    private outlineContainers: mod.UIWidget[] = [];  // Containers for outline version
    
    private readonly params: FlagIconParams;
    
    // Flag proportions
    private readonly POLE_WIDTH_RATIO = 0.15;
    private readonly POLE_HEIGHT_RATIO = 1.0;
    private readonly FLAG_WIDTH_RATIO = 0.85;
    private readonly FLAG_HEIGHT_RATIO = 0.55;
    
    constructor(params: FlagIconParams) {
        this.params = params;
        
        // Default values
        this.params.showFill = params.showFill ?? true;
        this.params.showOutline = params.showOutline ?? false;
        this.params.fillColor = VectorClampToRange(params.fillColor ?? mod.CreateVector(1, 1, 1), 0, 1);
        this.params.fillAlpha = params.fillAlpha ?? 1.0;
        this.params.outlineColor = VectorClampToRange(params.outlineColor ?? mod.CreateVector(1, 1, 1), 0, 1);
        this.params.outlineAlpha = params.outlineAlpha ?? 1.0;
        this.params.flagPoleGap = params.flagPoleGap ?? 2.0;
        
        // Create root container
        this.rootContainer = this.createRootContainer();
        
        // Create both filled and outline versions (layered)
        // Filled version is created first (rendered behind outline)
        this.createFilledFlag();
        this.createOutlineFlag();
        
        // Set initial visibility
        this.SetFillVisible(this.params.showFill ?? true);
        this.SetOutlineVisible(this.params.showOutline ?? true);
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
    
    private createFilledFlag(): void {
        const totalWidth = mod.XComponentOf(this.params.size);
        const totalHeight = mod.YComponentOf(this.params.size);
        
        const poleWidth = totalWidth * this.POLE_WIDTH_RATIO;
        const poleHeight = totalHeight * this.POLE_HEIGHT_RATIO;
        const flagWidth = totalWidth * this.FLAG_WIDTH_RATIO;
        const flagHeight = totalHeight * this.FLAG_HEIGHT_RATIO;
        const flagPoleGap = this.params.flagPoleGap ?? 2.0;
        
        const color = this.params.fillColor ?? mod.CreateVector(1, 1, 1);
        const alpha = this.params.fillAlpha ?? 1.0;
        const bgFill = this.params.bgFill ?? mod.UIBgFill.Blur;
        
        // Create pole (bottom-left, extending down from flag)
        const poleX = 0;
        const poleY = 0; //totalHeight - poleHeight;
        
        const pole = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_fill_pole`,
            position: [poleX, poleY],
            size: [poleWidth, poleHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: bgFill,
            padding: 0
        })!;

        const flag = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_fill_flag`,
            position: [poleWidth + flagPoleGap, flagPoleGap],
            size: [flagWidth - flagPoleGap, flagHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: bgFill,
            padding: 0
        })!;
        
        // Store both in fill containers array
        this.fillContainers = [pole, flag];
    }
    
    private createOutlineFlag(): void {
        const totalWidth = mod.XComponentOf(this.params.size);
        const totalHeight = mod.YComponentOf(this.params.size);
        const thickness = this.params.outlineThickness ?? 2;
        
        const poleWidth = totalWidth * this.POLE_WIDTH_RATIO;
        const poleHeight = totalHeight * this.POLE_HEIGHT_RATIO;
        const flagWidth = totalWidth * this.FLAG_WIDTH_RATIO;
        const flagHeight = totalHeight * this.FLAG_HEIGHT_RATIO;
        const flagPoleGap = this.params.flagPoleGap ?? 2.0;

        const color = VectorClampToRange(this.params.outlineColor ?? mod.CreateVector(1, 1, 1), 0, 1);
        const alpha = this.params.outlineAlpha ?? 1.0;

        const flag = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_outline_flag`,
            position: [poleWidth + flagPoleGap, flagPoleGap],
            size: [flagWidth - flagPoleGap, flagHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: mod.UIBgFill.OutlineThin,
            padding: 0
        })!;

        const pole = modlib.ParseUI({
            type: "Container",
            name: `${this.params.name}_outline_pole`,
            position: [0, 0],
            size: [poleWidth, poleHeight],
            anchor: mod.UIAnchor.TopLeft,
            parent: this.rootContainer,
            visible: true,
            bgColor: color,
            bgAlpha: alpha,
            bgFill: mod.UIBgFill.OutlineThin,
            padding: 0
        })!;
        
        // Store all outline segments in outline containers array
        this.outlineContainers = [flag, pole];
    }

    IsVisible(): boolean {
        return mod.GetUIWidgetVisible(this.rootContainer);
    }
    
    /**
     * Show or hide the filled version of the flag
     */
    SetFillVisible(visible: boolean): void {
        this.params.showFill = visible;
        this.fillContainers.forEach(container => {
            mod.SetUIWidgetVisible(container, visible);
        });
    }
    
    /**
     * Show or hide the outline version of the flag
     */
    SetOutlineVisible(visible: boolean): void {
        this.params.showOutline = visible;
        this.outlineContainers.forEach(container => {
            mod.SetUIWidgetVisible(container, visible);
        });
    }
    
    /**
     * Check if fill is currently visible
     */
    IsFillVisible(): boolean {
        return this.params.showFill ?? false;
    }
    
    /**
     * Check if outline is currently visible
     */
    IsOutlineVisible(): boolean {
        return this.params.showOutline ?? false;
    }
    
    /**
     * Update the fill color and optionally the alpha
     */
    SetFillColor(color: mod.Vector, alpha?: number): void {
        const newAlpha = alpha ?? this.params.fillAlpha ?? 1.0;
        let clampedColor = VectorClampToRange(color, 0, 1);

        // Update fill containers
        this.fillContainers.forEach(container => {
            mod.SetUIWidgetBgColor(container, clampedColor);
            mod.SetUIWidgetBgAlpha(container, newAlpha);
        });
        
        // Store new values
        this.params.fillColor = clampedColor;
        this.params.fillAlpha = newAlpha;
    }

    SetFillAlpha(alpha: number): void {
        if(AreFloatsEqual(alpha, this.params.fillAlpha ?? 1.0))
            return;
        
        this.params.fillAlpha = alpha;
        
        // Update fill containers
        this.fillContainers.forEach(container => {
            mod.SetUIWidgetBgAlpha(container, alpha);
        });
    }

    
    /**
     * Update the outline color and optionally the alpha
     */
    SetOutlineColor(color: mod.Vector, alpha?: number): void {
        const newAlpha = alpha ?? this.params.outlineAlpha ?? 1.0;
        let clampedColor = VectorClampToRange(color, 0, 1);
        
        // Update outline containers
        this.outlineContainers.forEach(container => {
            mod.SetUIWidgetBgColor(container, clampedColor);
            mod.SetUIWidgetBgAlpha(container, newAlpha);
        });
        
        // Store new values
        this.params.outlineColor = clampedColor;
        this.params.outlineAlpha = newAlpha;
    }

    SetOutlineAlpha(alpha: number): void {
        if(AreFloatsEqual(alpha, this.params.outlineAlpha ?? 1.0))
            return;
        
        this.params.outlineAlpha = alpha;
        
        // Update fill containers
        this.outlineContainers.forEach(container => {
            mod.SetUIWidgetBgAlpha(container, alpha);
        });
    }
    
    /**
     * Update both fill and outline colors
     */
    SetColor(color: mod.Vector, alpha?: number): void {
        this.SetFillColor(color, alpha);
        this.SetOutlineColor(color, alpha);
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
        // Delete fill containers
        this.fillContainers.forEach(container => {
            mod.DeleteUIWidget(container);
        });
        
        // Delete outline containers
        this.outlineContainers.forEach(container => {
            mod.DeleteUIWidget(container);
        });
        
        // Delete root container
        mod.DeleteUIWidget(this.rootContainer);
        
        this.fillContainers = [];
        this.outlineContainers = [];
    }
    
    /**
     * Get the root container widget
     */
    GetRootWidget(): mod.UIWidget {
        return this.rootContainer;
    }
}
