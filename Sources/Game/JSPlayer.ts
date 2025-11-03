//==============================================================================================
// JSPLAYER CLASS
//==============================================================================================

class PlayerScore {
    captures: number
    capture_assists: number
    flag_carrier_kills: number
    kills: number;

    constructor(captures: number = 0, capture_assists: number = 0, flag_carrier_kills:number = 0, kills = 0){
        this.captures = captures;
        this.capture_assists = capture_assists
        this.flag_carrier_kills = flag_carrier_kills
        this.kills = kills;
    }
}

class JSPlayer {
    // Player game attributes
    readonly player: mod.Player;
    readonly playerId: number;
    score: PlayerScore;
    readonly joinOrder: number; // Track join order for team balancing
    heldFlags: Flag[] = [];

    // Player world attributes
    lastPosition: mod.Vector = ZERO_VEC;
    velocity: mod.Vector = ZERO_VEC;
    
    // UI
    scoreboardUI?: BaseScoreboardHUD;

    static playerInstances: mod.Player[] = [];
    static #allJsPlayers: { [key: number]: JSPlayer } = {};
    static #nextJoinOrder: number = 0; // Counter for join order

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        this.score = new PlayerScore();
        this.joinOrder = JSPlayer.#nextJoinOrder++;
        JSPlayer.playerInstances.push(this.player);
        
        if (DEBUG_MODE) {
            console.log(`CTF: Adding Player [${this.playerId}] with join order ${this.joinOrder}. Total: ${JSPlayer.playerInstances.length}`);
        }
    }

    initUI(): void {
        // Create scoreboard UI for human players
        if(!this.scoreboardUI){
            if (!mod.GetSoldierState(this.player, mod.SoldierStateBool.IsAISoldier)) {
                if (currentHUDClass) {
                    this.scoreboardUI = new currentHUDClass(this.player);
                }
            }
        }
    }

    resetUI(): void {
        delete this.scoreboardUI;
        this.initUI();
    }

    static get(player: mod.Player): JSPlayer | undefined {
        if (!gameStarted && mod.GetObjId(player) > -1) {
            return undefined;
        }
        
        if (mod.GetObjId(player) > -1) {
            let index = mod.GetObjId(player);
            let jsPlayer = this.#allJsPlayers[index];
            if (!jsPlayer) {
                jsPlayer = new JSPlayer(player);
                this.#allJsPlayers[index] = jsPlayer;
            }
            return jsPlayer;
        }
        return undefined;
    }

    static removeInvalidJSPlayers(invalidPlayerId: number): void {
        if (!gameStarted) return;
        
        if (DEBUG_MODE) {
            console.log(`Removing Invalid JSPlayer. Currently: ${JSPlayer.playerInstances.length}`);
        }
        
        // Remove from allJsPlayers
        delete this.#allJsPlayers[invalidPlayerId];
        
        // Remove from playerInstances array
        let indexToRemove = -1;
        for (let i = 0; i < JSPlayer.playerInstances.length; i++) {
            if (mod.GetObjId(JSPlayer.playerInstances[i]) === invalidPlayerId) {
                indexToRemove = i;
                break;
            }
        }
        
        if (indexToRemove > -1) {
            JSPlayer.playerInstances.splice(indexToRemove, 1);
        }
        
        if (DEBUG_MODE) {
            console.log(`Player [${invalidPlayerId}] removed. JSPlayers Remaining: ${JSPlayer.playerInstances.length}`);
        }
    }

    static getAllAsArray(): JSPlayer[] {
        return Object.values(this.#allJsPlayers);
    }
}
