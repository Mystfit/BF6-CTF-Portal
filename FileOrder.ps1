# FileOrder.ps1 - File dependency order configuration for CTF TypeScript compilation
# This file defines the order in which TypeScript files should be concatenated
# Files are concatenated in this exact order to ensure declarations come before usage

@{
    # Level 0: Constants, enums, and basic type definitions (no dependencies)
    0 = @(
        # Main constants file should be first
        "imports.ts"
        "Config.ts",
        "Main.ts"
    )
    
    # Level 1: Utility classes and namespaces (minimal dependencies)
    1 = @(
        "Utility/Colour.ts",
        "Utility/Math.ts"
    )
    
    # Level 2: Core infrastructure (uses Level 0-1)
    2 = @(
        "Utility/Raycasts.ts",
        "Utility/Animation.ts",
        "Utility/EventDispatcher.ts"
    )
    
    # Level 3: Game data classes (uses Level 0-2)
    3 = @(
        "Game/JSPlayer.ts"
        "Game/Scoring.ts"
    )
    
    # Level 4: Entity classes (uses Level 0-3)
    4 = @(
        "Entities/Flag.ts",
        "Entities/CaptureZone.ts"
    )

    # Level 5: UI classes (uses most other classes)
    5 = @(
        "UI/BaseScoreHUD.ts",
        "UI/TickerWidget.ts",
        "UI/ScoreTicker.ts",
        "UI/RoundTimer.ts"
        "UI/FlagBar.ts",
        "UI/FlagIcon.ts"
        "UI/TeamInstructionBar.ts",
        "UI/MultiTeamScoreHUD.ts",
        "UI/ClassicCTFScoreHUD.ts",
        "UI/GlobalScoreboardHUD.ts",
        "UI/TeamScoreboardHUD.ts",
        "UI/PlayerScoreboardHUD.ts"
    )
    
    # Level 6: Configuration (uses Level 0-4)
    6 = @(
        "Game/GameModeConfig.ts",
        "Game/Configs/ClassicCTF.ts",
        "Game/Configs/FourTeamCTF.ts"
        "Game/GameModeLookup.ts"
    )
    

    
    # Level 7: Game logic (uses everything)
    7 = @(
        "Game/TeamBalance.ts"
    )
}
