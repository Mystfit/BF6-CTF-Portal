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
        this.SetTeamOrder(this.lastOrder);
        
        // Bind to all flag events
        this.bindFlagEvents();
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
        // Clean up event listeners
        for (const unsubscribe of this.eventUnsubscribers) {
            unsubscribe();
        }
        this.eventUnsubscribers = [];
    }

    SetTeamOrder(teamOrder: TeamOrders): void {
        this.updateText(this.TeamOrderToMessage(teamOrder));
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
