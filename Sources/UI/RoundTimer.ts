//==============================================================================================
// ROUND TIMER - Display remaining game time in mm:ss format
//==============================================================================================

interface RoundTimerParams {
    position: number[];
    size: number[];
    parent: mod.UIWidget;
    textSize?: number;
    seperatorPadding?: number;
    bracketTopBottomLength?: number;
    bracketThickness?: number;
    bgColor?: mod.Vector;
    textColor?: mod.Vector;
    bgAlpha?: number;

}

class RoundTimer extends TickerWidget {
    private currentTimeSeconds: number = -1;
    private currentTimeMinutes: number = -1;
    private seperatorPadding: number;
    private secondsText: mod.UIWidget;
    private minutesText: mod.UIWidget;
    private seperatorText: mod.UIWidget;
    
    constructor(params: RoundTimerParams) {        
        // Call parent constructor with default neutral colors if not specified
        super({
            position: params.position,
            size: params.size,
            parent: params.parent,
            textSize: params.textSize,
            bracketTopBottomLength: params.bracketTopBottomLength,
            bracketThickness: params.bracketThickness,
            bgColor: params.bgColor ?? mod.CreateVector(0.2, 0.2, 0.2),
            textColor: params.textColor ?? mod.CreateVector(1, 1, 1),
            bgAlpha: params.bgAlpha ?? 0.75
        });

        this.seperatorPadding = params.seperatorPadding ?? 16;

        this.secondsText = modlib.ParseUI({
            type: "Text",
            parent: this.columnWidget,
            position: [this.seperatorPadding, 0],
            size: [30, 24],
            anchor: mod.UIAnchor.Center,
            textAnchor: mod.UIAnchor.CenterLeft,
            textSize: this.textSize,
            textLabel: "",
            textColor: this.textColor,
            bgAlpha: 0,
        })!;

        this.minutesText = modlib.ParseUI({
            type: "Text",
            parent: this.columnWidget,
            position: [-this.seperatorPadding, 0],
            size: [5, 24],
            anchor: mod.UIAnchor.Center,
            textAnchor: mod.UIAnchor.CenterRight,
            textSize: this.textSize,
            textLabel: "",
            textColor: this.textColor,
            bgAlpha: 0,
        })!;

        this.seperatorText = modlib.ParseUI({
            type: "Text",
            parent: this.columnWidget,
            position: [0, 0],
            size: [30, 24],
            anchor: mod.UIAnchor.Center,
            textAnchor: mod.UIAnchor.Center,
            textSize: this.textSize,
            textLabel: mod.stringkeys.score_timer_seperator,
            textColor: this.textColor,
            bgAlpha: 0,
        })!;
        
        this.refresh();
    }
    
    /**
     * Update the timer display with remaining game time
     */
    public updateTime(): void {
        const remainingTime = mod.GetMatchTimeRemaining();
        const timeSeconds = Math.floor(remainingTime);
        
        // Only update if time has changed
        if (this.currentTimeSeconds !== timeSeconds) {

            // Update time values and floor/pad values
            this.currentTimeSeconds = timeSeconds % 60;
            this.currentTimeMinutes = Math.floor(timeSeconds / 60);
            const secondsTensDigit = Math.floor(this.currentTimeSeconds / 10);
            const secondsOnesDigit = this.currentTimeSeconds % 10;

            // Update text labels
            mod.SetUITextLabel(this.minutesText, mod.Message(mod.stringkeys.score_timer_minutes, this.currentTimeMinutes));
            mod.SetUITextLabel(this.secondsText, mod.Message(mod.stringkeys.score_timer_seconds, secondsTensDigit, secondsOnesDigit));
        }
    }
    
    /**
     * Refresh the timer display
     */
    public refresh(): void {
        this.updateTime();
    }

    /**
     * Destroy all UI widgets created by this timer
     */
    public destroy(): void {
        // Delete timer-specific widgets
        if (this.secondsText) mod.DeleteUIWidget(this.secondsText);
        if (this.minutesText) mod.DeleteUIWidget(this.minutesText);
        if (this.seperatorText) mod.DeleteUIWidget(this.seperatorText);

        // Call parent destroy for base ticker widgets
        super.destroy();
    }
}
