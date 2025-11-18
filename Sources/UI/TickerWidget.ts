//==============================================================================================
// TICKER WIDGET BASE CLASS - Base class for UI widgets with position, text, background, and brackets
//==============================================================================================

import { ParseUI } from "modlib";

interface TickerWidgetParams {
    position: number[];
    size: number[];
    parent: mod.UIWidget;
    textSize?: number;
    bracketTopBottomLength?: number;
    bracketThickness?: number;
    bgColor?: mod.Vector;
    textColor?: mod.Vector;
    bgAlpha?: number;
    showProgressBar?: boolean;
    progressValue?: number;
    progressDirection?: 'left' | 'right';
}

abstract class TickerWidget {
    readonly parent: mod.UIWidget;
    readonly position: number[];
    readonly size: number[];
    readonly textSize: number;
    readonly bracketTopBottomLength: number;
    readonly bracketThickness: number;
    protected bgColor: mod.Vector;
    protected textColor: mod.Vector;
    protected bgAlpha: number;
    
    // Main widgets
    protected columnWidget!: mod.UIWidget;
    protected columnWidgetOutline!: mod.UIWidget;
    protected textWidget!: mod.UIWidget;
    protected pulseGradientWidget!: mod.UIWidget;
    
    // Progress bar
    protected progressBarContainer: mod.UIWidget | undefined;
    protected progressValue: number;
    protected progressDirection: 'left' | 'right';
    protected showProgressBar: boolean;
    
    // Leading indicator brackets (left side)
    protected leftBracketSide: mod.UIWidget | undefined;
    protected leftBracketTop: mod.UIWidget | undefined;
    protected leftBracketBottom: mod.UIWidget | undefined;
    
    // Leading indicator brackets (right side)
    protected rightBracketSide: mod.UIWidget | undefined;
    protected rightBracketTop: mod.UIWidget | undefined;
    protected rightBracketBottom: mod.UIWidget | undefined;

    // Animation
    isPulsing = false;
    
    constructor(params: TickerWidgetParams) {
        this.parent = params.parent;
        this.position = params.position ?? [0, 0];
        this.size = params.size ?? [0, 0];
        this.textSize = params.textSize ?? 30;
        this.bracketTopBottomLength = params.bracketTopBottomLength ?? 8;
        this.bracketThickness = params.bracketThickness ?? 2;
        this.bgColor = params.bgColor ?? mod.CreateVector(0.5, 0.5, 0.5);
        this.textColor = params.textColor ?? mod.CreateVector(1, 1, 1);
        this.bgAlpha = params.bgAlpha ?? 0.75;
        this.showProgressBar = params.showProgressBar ?? false;
        this.progressValue = params.progressValue ?? 1.0;
        this.progressDirection = params.progressDirection ?? 'left';
        
        this.createWidgets();
    }
    
    /**
     * Create all UI widgets for the ticker
     */
    protected createWidgets(): void {
        // Create column container with background color
        this.columnWidget = modlib.ParseUI({
            type: "Container",
            parent: this.parent,
            position: this.position,
            size: [this.size[0], this.size[1]],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.Blur,
            bgColor: this.bgColor,
            bgAlpha: this.bgAlpha
        })!;

        // Create column container with outline
        this.columnWidgetOutline = modlib.ParseUI({
            type: "Container",
            parent: this.parent,
            position: this.position,
            size: [this.size[0], this.size[1]],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.OutlineThin,
            bgColor: this.textColor,
            bgAlpha: 0
        })!;
        
        // Create text widget
        this.createTextWidget();
        
        // Create progress bar if enabled
        if (this.showProgressBar) {
            this.createProgressBar();
        }

        // Create gradient pulse effect
        this.pulseGradientWidget = ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [0, this.size[1]],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.GradientRight,
            bgColor: this.textColor,
            bgAlpha: 0.6
        })!;
        
        // Create leading indicator brackets
        this.createBrackets();
    }
    
    /**
     * Create the text widget - can be overridden by subclasses for custom styling
     */
    protected createTextWidget(): void {
        this.textWidget = modlib.ParseUI({
            type: "Text",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.size[0], 25],
            anchor: mod.UIAnchor.Center,
            textAnchor: mod.UIAnchor.Center,
            textSize: this.textSize,
            textLabel: mod.stringkeys.empty_string,
            textColor: this.textColor,
            bgAlpha: 0,
        })!;
    }
    
    /**
     * Create progress bar container
     */
    protected createProgressBar(): void {
        const progressWidth = this.size[0] * this.progressValue;
        const anchor = this.progressDirection === 'left' ? mod.UIAnchor.CenterLeft : mod.UIAnchor.CenterRight;
        
        this.progressBarContainer = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [progressWidth, this.size[1]],
            anchor: anchor,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 0.9
        })!;
    }
    
    /**
     * Set the progress bar value (0.0 to 1.0)
     */
    public setProgressValue(value: number): void {
        this.progressValue = Math.max(0, Math.min(1, value));
        
        if (this.progressBarContainer) {
            const progressWidth = this.size[0] * this.progressValue;
            mod.SetUIWidgetSize(this.progressBarContainer, mod.CreateVector(progressWidth, this.size[1], 0));
        }
    }
    
    /**
     * Set the progress bar fill direction
     */
    public setProgressDirection(direction: 'left' | 'right'): void {
        this.progressDirection = direction;
        
        if (this.progressBarContainer) {
            const anchor = direction === 'left' ? mod.UIAnchor.CenterLeft : mod.UIAnchor.CenterRight;
            mod.SetUIWidgetAnchor(this.progressBarContainer, anchor);
        }
    }
    
    /**
     * Get the progress bar value
     */
    public getProgressValue(): number {
        return this.progressValue;
    }
    
    /**
     * Create bracket indicators for highlighting
     * Brackets form open/close square bracket shapes on each side
     */
    protected createBrackets(): void {
        // LEFT BRACKETS (opening bracket [)
        // Left side vertical bar
        this.leftBracketSide = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketThickness, this.size[1]],
            anchor: mod.UIAnchor.CenterLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // Left top horizontal bar
        this.leftBracketTop = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketTopBottomLength, this.bracketThickness],
            anchor: mod.UIAnchor.TopLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // Left bottom horizontal bar
        this.leftBracketBottom = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketTopBottomLength, this.bracketThickness],
            anchor: mod.UIAnchor.BottomLeft,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // RIGHT BRACKETS (closing bracket ])
        // Right side vertical bar
        this.rightBracketSide = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketThickness, this.size[1]],
            anchor: mod.UIAnchor.CenterRight,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // Right top horizontal bar
        this.rightBracketTop = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketTopBottomLength, this.bracketThickness],
            anchor: mod.UIAnchor.TopRight,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // Right bottom horizontal bar
        this.rightBracketBottom = modlib.ParseUI({
            type: "Container",
            parent: this.columnWidget,
            position: [0, 0],
            size: [this.bracketTopBottomLength, this.bracketThickness],
            anchor: mod.UIAnchor.BottomRight,
            bgFill: mod.UIBgFill.Solid,
            bgColor: this.textColor,
            bgAlpha: 1
        })!;
        
        // Hide brackets by default
        this.showBrackets(false);
    }
    
    /**
     * Update the text displayed in the widget
     */
    protected updateText(message: mod.Message): void {
        mod.SetUITextLabel(this.textWidget, message);
    }
    
    /**
     * Show or hide the bracket indicators
     */
    protected showBrackets(show: boolean): void {
        if (this.leftBracketTop) mod.SetUIWidgetVisible(this.leftBracketTop, show);
        if (this.leftBracketSide) mod.SetUIWidgetVisible(this.leftBracketSide, show);
        if (this.leftBracketBottom) mod.SetUIWidgetVisible(this.leftBracketBottom, show);
        if (this.rightBracketSide) mod.SetUIWidgetVisible(this.rightBracketSide, show);
        if (this.rightBracketTop) mod.SetUIWidgetVisible(this.rightBracketTop, show);
        if (this.rightBracketBottom) mod.SetUIWidgetVisible(this.rightBracketBottom, show);
    }

    
    async StartThrob(pulseSpeed?: number, minimumAlpha?: number, maximumAlpha?: number): Promise<void> {
        if(this.isPulsing)
            return;

        let minAlpha = minimumAlpha ?? 0;
        let maxAlpha = maximumAlpha ?? 1;
        let speed = pulseSpeed ?? 0.1;

        this.isPulsing = true;
        let time = 0;
        while(this.isPulsing){
            time = GetCurrentTime();
            let blinkActive = Math.round(Math2.TriangleWave(time, 1, 1)) > 0;
            this.showBrackets(blinkActive);
            await mod.Wait(TICK_RATE);
        }
    }

    StopThrob(): void {
        this.isPulsing = false;
    }

    async pulse(reverse?: boolean): Promise<void> {
        if(this.isPulsing)
            return;

        // Set start state
        this.isPulsing = true;
        let startSizeVec = mod.GetUIWidgetSize(this.columnWidget);
        let startSize: number[] = this.size;
        let startPosition: number[] = [0,0];

        // Configure gradient direction and anchor based on reverse parameter
        if (reverse) {
            // Right-to-left: Use left gradient anchored to the right
            mod.SetUIWidgetBgFill(this.pulseGradientWidget, mod.UIBgFill.GradientLeft);
            mod.SetUIWidgetAnchor(this.pulseGradientWidget, mod.UIAnchor.TopRight);
        } else {
            // Left-to-right: Use right gradient anchored to the left
            mod.SetUIWidgetBgFill(this.pulseGradientWidget, mod.UIBgFill.GradientRight);
            mod.SetUIWidgetAnchor(this.pulseGradientWidget, mod.UIAnchor.TopLeft);
        }

        mod.SetUIWidgetSize(this.pulseGradientWidget, mod.CreateVector(5, startSize[1], 0));
        mod.SetUIWidgetPosition(this.pulseGradientWidget, mod.CreateVector(startPosition[0], startPosition[1], 0));

        // Scale up gradient wipe
        await animationManager.AnimateValue(0, startSize[0], {
            duration: 0.25,
            easingFunction: Easing.EaseInSine,
            onProgress: (value, normalizedTime) => {
                mod.SetUIWidgetPosition(this.pulseGradientWidget, ZERO_VEC);
                mod.SetUIWidgetSize(this.pulseGradientWidget, mod.CreateVector(value, startSize[1], 0));
            },
        }).then(async ()=>{
            await animationManager.AnimateValue(0, startSize[0],
            {
                duration: 0.25,
                easingFunction: Easing.EaseOutSine,
                onProgress: (value, normalizedTime) => {
                    if (reverse) {
                        // Right-to-left: Move left and shrink
                        mod.SetUIWidgetPosition(this.pulseGradientWidget, mod.CreateVector(value - 4, 0, 0));
                    } else {
                        // Left-to-right: Move right and shrink
                        mod.SetUIWidgetPosition(this.pulseGradientWidget, mod.CreateVector(value - 4, 0, 0));
                    }
                    mod.SetUIWidgetSize(this.pulseGradientWidget, mod.CreateVector(startSize[0] - value, startSize[1], 0));
                },
            });
            
            this.isPulsing = false;
        });
    }

    /**
     * Destroy all UI widgets created by this ticker
     * Should be called before discarding the ticker instance
     */
    public destroy(): void {
        // Delete all bracket widgets
        if (this.leftBracketTop) mod.DeleteUIWidget(this.leftBracketTop);
        if (this.leftBracketSide) mod.DeleteUIWidget(this.leftBracketSide);
        if (this.leftBracketBottom) mod.DeleteUIWidget(this.leftBracketBottom);
        if (this.rightBracketTop) mod.DeleteUIWidget(this.rightBracketTop);
        if (this.rightBracketSide) mod.DeleteUIWidget(this.rightBracketSide);
        if (this.rightBracketBottom) mod.DeleteUIWidget(this.rightBracketBottom);

        // Delete progress bar
        if (this.progressBarContainer) mod.DeleteUIWidget(this.progressBarContainer);

        // Delete text widget
        if (this.textWidget) mod.DeleteUIWidget(this.textWidget);

        // Delete outline and main container
        if (this.columnWidgetOutline) mod.DeleteUIWidget(this.columnWidgetOutline);
        if (this.columnWidget) mod.DeleteUIWidget(this.columnWidget);
    }

    /**
     * Refresh the widget - should be implemented by subclasses
     */
    abstract refresh(): void;
}
