//==============================================================================================
// BASE SCORE HUD
//==============================================================================================

interface BaseScoreboardHUD {
    readonly player: mod.Player;
    readonly playerId: number;
    readonly rootWidget: mod.UIWidget | undefined;

    create(): void;
    refresh(): void;
    close(): void;
    isOpen(): boolean;
}