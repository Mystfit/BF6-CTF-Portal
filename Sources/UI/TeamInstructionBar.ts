enum TeamOrders {
    OurFlagTaken = 0,
    OurFlagDropped,
    OurFlagReturned,
    EnemyFlagTaken,
    EnemyFlagDropped,
    EnemyFlagReturned,
    TeamIdentify
}

class TeamOrdersBar extends TickerWidget {
    team: mod.Team;
    lastOrder: TeamOrders;

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
        this.lastOrder = TeamOrders.TeamIdentify;
        this.SetTeamOrder(this.lastOrder);
    }
    
    refresh(): void{
        for(let [flagId, flag] of flags){
            // These should be bound based on events...
        }
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
            case TeamOrders.EnemyFlagTaken:
                return mod.Message(mod.stringkeys.order_flag_taken, mod.stringkeys.order_enemy);
            case TeamOrders.EnemyFlagDropped:
                return mod.Message(mod.stringkeys.order_flag_dropped, mod.stringkeys.order_enemy);
            case TeamOrders.EnemyFlagReturned:
                return mod.Message(mod.stringkeys.order_flag_returned, mod.stringkeys.order_enemy);
            case TeamOrders.TeamIdentify:
                return mod.Message(mod.stringkeys.order_team_identifier, GetTeamName(this.team));
        }
        return mod.Message(mod.stringkeys.order_team_identifier, GetTeamName(this.team));
    }
}

