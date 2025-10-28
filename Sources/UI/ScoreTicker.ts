class ScoreTicker implements BaseScoreboardHUD {
    player: mod.Player;
    playerId: number;
    rootWidget: mod.UIWidget | undefined;

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
    }
    
    create(): void {
        throw new Error("Method not implemented.");
    }
    refresh(): void {
        throw new Error("Method not implemented.");
    }
    close(): void {
        throw new Error("Method not implemented.");
    }
    isOpen(): boolean {
        throw new Error("Method not implemented.");
    }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 
}