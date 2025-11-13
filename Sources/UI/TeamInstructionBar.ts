enum TeamOrders {
    OurFlagTaken = 0,
    OurFlagDropped,
    OurFlagReturned,
    OurFlagCaptured,
    EnemyFlagTaken,
    EnemyFlagDropped,
    EnemyFlagReturned,
    EnemyFlagCaptured,
    TeamIdentify
}

class TeamOrdersBar extends TickerWidget {
    team: mod.Team;
    teamId: number;
    lastOrder: TeamOrders;
    private eventUnsubscribers: Array<() => void> = [];

    // Animation state
    private isExpanded: boolean = false;
    private isAnimating: boolean = false;
    private isTextVisible: boolean = false;
    private collapseTimeoutTime: number | null = null;
    private readonly normalHeight: number = 30;
    private readonly minimizedHeight: number = 4;
    private readonly expandDuration: number = 0.4;
    private readonly collapseDuration: number = 0.3;
    private readonly visibleDuration: number = 5.0;
    private currentHeight: number = 4;

    constructor(team:mod.Team, tickerParams: TickerWidgetParams) {
         // Call parent constructor with team-specific colors
        super({
            position: tickerParams.position,
            size: tickerParams.size,
            parent: tickerParams.parent,
            textSize: tickerParams.textSize,
            bracketTopBottomLength: tickerParams.bracketTopBottomLength,
            bracketThickness: tickerParams.bracketThickness,
            bgColor: GetTeamColor(team),
            textColor: 
            VectorClampToRange(
                GetTeamColorLight(team), 
                0, 
                1
            ),
            bgAlpha: 0.75
        });

        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.lastOrder = TeamOrders.TeamIdentify;

        // Set initial text (widget now exists after super() called createWidgets())
        this.updateText(this.TeamOrderToMessage(this.lastOrder));

        // Initialize in minimized state (after widgets are created)
        this.updateWidgetSizes(this.minimizedHeight);
        const textWidget = (this as any).textWidget as mod.UIWidget;
        if (textWidget) {
            mod.SetUIWidgetVisible(textWidget, false);
            this.isTextVisible = false;
        }

        // Bind to all flag events
        this.bindFlagEvents();
    }

    /**
     * Update widget sizes for animation
     * @param height The new height in pixels
     */
    private updateWidgetSizes(height: number): void {
        this.currentHeight = height;
        const newSize = mod.CreateVector(this.size[0], height, 0);
        const columnWidget = (this as any).columnWidget as mod.UIWidget;
        const columnWidgetOutline = (this as any).columnWidgetOutline as mod.UIWidget;
        mod.SetUIWidgetSize(columnWidget, newSize);
        mod.SetUIWidgetSize(columnWidgetOutline, newSize);
    }

    /**
     * Expand bar animation from minimized to normal state
     */
    private async expandBar(): Promise<void> {
        if (this.isAnimating) return;

        // Cancel any pending collapse
        this.collapseTimeoutTime = null;

        this.isAnimating = true;
        const startHeight = this.currentHeight;

        await animationManager.AnimateValue(startHeight, this.normalHeight, {
            duration: this.expandDuration,
            easingFunction: Easing.EaseOutCubic,
            onProgress: (height, normalizedTime) => {
                this.updateWidgetSizes(height);

                // Show text at 50% progress
                if (normalizedTime >= 0.5 && !this.isTextVisible) {
                    const textWidget = (this as any).textWidget as mod.UIWidget;
                    mod.SetUIWidgetVisible(textWidget, true);
                    this.isTextVisible = true;
                }
            },
            onComplete: () => {
                this.isExpanded = true;
                this.isAnimating = false;
                this.startCollapseTimer();
            }
        });
    }

    /**
     * Collapse bar animation from normal to minimized state
     */
    private async collapseBar(): Promise<void> {
        if (this.isAnimating || !this.isExpanded) return;

        // Cancel any pending collapse
        this.collapseTimeoutTime = null;

        this.isAnimating = true;
        const startHeight = this.currentHeight;

        await animationManager.AnimateValue(startHeight, this.minimizedHeight, {
            duration: this.collapseDuration,
            easingFunction: Easing.EaseInCubic,
            onProgress: (height, normalizedTime) => {
                this.updateWidgetSizes(height);

                // Hide text at 50% progress
                if (normalizedTime >= 0.5 && this.isTextVisible) {
                    const textWidget = (this as any).textWidget as mod.UIWidget;
                    mod.SetUIWidgetVisible(textWidget, false);
                    this.isTextVisible = false;
                }
            },
            onComplete: () => {
                this.isExpanded = false;
                this.isAnimating = false;
            }
        });
    }

    /**
     * Start the timer for auto-collapse
     */
    private startCollapseTimer(): void {
        // Set timeout time
        this.collapseTimeoutTime = GetCurrentTime() + this.visibleDuration;

        // Start async countdown
        this.checkCollapseTimeout();
    }

    /**
     * Check if collapse timeout has elapsed
     */
    private async checkCollapseTimeout(): Promise<void> {
        if (this.collapseTimeoutTime === null) return;

        const timeoutTime = this.collapseTimeoutTime;

        // Wait for the duration
        await mod.Wait(this.visibleDuration);

        // Check if timeout wasn't cancelled or reset
        if (this.collapseTimeoutTime === timeoutTime && this.isExpanded && !this.isAnimating) {
            this.collapseBar();
        }
    }

    private bindFlagEvents(): void {
        // Bind to each flag's events
        for (let [flagId, flag] of flags) {
            // Flag taken event
            const unsubTaken = flag.events.on('flagTaken', (data) => {
                this.handleFlagTaken(data.flag, data.player, data.isAtHome);
            });
            this.eventUnsubscribers.push(unsubTaken);
            
            // Flag dropped event
            const unsubDropped = flag.events.on('flagDropped', (data) => {
                this.handleFlagDropped(data.flag, data.position, data.previousCarrier);
            });
            this.eventUnsubscribers.push(unsubDropped);
            
            // Flag returned event
            const unsubReturned = flag.events.on('flagReturned', (data) => {
                this.handleFlagReturned(data.flag, data.wasAutoReturned);
            });
            this.eventUnsubscribers.push(unsubReturned);

            const unsubCaptured = flag.events.on("flagCaptured", (data) => {
                this.handleFlagCaptured(data.flag);
            });
            this.eventUnsubscribers.push(unsubCaptured);
        }
    }
    
    private handleFlagTaken(flag: Flag, player: mod.Player, wasAtHome: boolean): void {
        const playerTeamId = mod.GetObjId(mod.GetTeam(player));
        
        // Check if this is our team's flag
        if (flag.teamId === this.teamId) {
            // Our flag was taken
            this.SetTeamOrder(TeamOrders.OurFlagTaken);
        } else if (playerTeamId === this.teamId) {
            // We took the enemy flag
            this.SetTeamOrder(TeamOrders.EnemyFlagTaken);
        }
    }
    
    private handleFlagDropped(flag: Flag, position: mod.Vector, previousCarrier: mod.Player | null): void {
        // Check if this is our team's flag
        if (flag.teamId === this.teamId) {
            // Our flag was dropped
            this.SetTeamOrder(TeamOrders.OurFlagDropped);
        } else {
            // Enemy flag was dropped (check if we were carrying it)
            if (previousCarrier) {
                const carrierTeamId = mod.GetObjId(mod.GetTeam(previousCarrier));
                if (carrierTeamId === this.teamId) {
                    this.SetTeamOrder(TeamOrders.EnemyFlagDropped);
                }
            }
        }
    }
    
    private handleFlagReturned(flag: Flag, wasAutoReturned: boolean): void {
        // Check if this is our team's flag
        if (flag.teamId === this.teamId) {
            // Our flag was returned
            this.SetTeamOrder(TeamOrders.OurFlagReturned);
        } else {
            // Enemy flag was returned
            this.SetTeamOrder(TeamOrders.EnemyFlagReturned);
        }
    }

     private handleFlagCaptured(flag: Flag): void {
        // Check if this is our team's flag
        if (flag.teamId === this.teamId) {
            // Our flag was captured
            this.SetTeamOrder(TeamOrders.OurFlagCaptured);
        } else {
            // Enemy flag was returned
            this.SetTeamOrder(TeamOrders.EnemyFlagCaptured);
        }
    }
    
    refresh(): void {
        // Update display based on current flag states
        // This is called periodically to ensure UI is in sync
    }
    
    destroy(): void {
        // Cancel any pending collapse animation
        this.collapseTimeoutTime = null;

        // Clean up event listeners
        for (const unsubscribe of this.eventUnsubscribers) {
            unsubscribe();
        }
        this.eventUnsubscribers = [];

        // Call parent destroy to clean up UI widgets
        super.destroy();
    }

    SetTeamOrder(teamOrder: TeamOrders): void {
        this.lastOrder = teamOrder;
        this.updateText(this.TeamOrderToMessage(teamOrder));

        // Trigger expand animation if not already expanded
        if (!this.isExpanded && !this.isAnimating) {
            this.expandBar(); // Fire and forget (non-blocking)
        } else if (this.isExpanded) {
            // Already expanded, just reset the collapse timer
            this.startCollapseTimer();
        }
    }

    TeamOrderToMessage(order:TeamOrders): mod.Message {
        switch(order){
            case TeamOrders.OurFlagTaken:
                return mod.Message(mod.stringkeys.order_flag_taken, mod.stringkeys.order_friendly);
            case TeamOrders.OurFlagDropped:
                return mod.Message(mod.stringkeys.order_flag_dropped, mod.stringkeys.order_friendly);
            case TeamOrders.OurFlagReturned:
                return mod.Message(mod.stringkeys.order_flag_returned, mod.stringkeys.order_friendly);
            case TeamOrders.OurFlagCaptured:
                return mod.Message(mod.stringkeys.order_flag_captured_friendly);
            case TeamOrders.EnemyFlagTaken:
                return mod.Message(mod.stringkeys.order_flag_taken, mod.stringkeys.order_enemy);
            case TeamOrders.EnemyFlagDropped:
                return mod.Message(mod.stringkeys.order_flag_dropped, mod.stringkeys.order_enemy);
            case TeamOrders.EnemyFlagReturned:
                return mod.Message(mod.stringkeys.order_flag_returned, mod.stringkeys.order_enemy);
            case TeamOrders.EnemyFlagCaptured:
                return mod.Message(mod.stringkeys.order_flag_captured_enemy);
            case TeamOrders.TeamIdentify:
                return mod.Message(mod.stringkeys.order_team_identifier, GetTeamName(this.team));
        }
        return mod.Message(mod.stringkeys.order_team_identifier, GetTeamName(this.team));
    }
}
