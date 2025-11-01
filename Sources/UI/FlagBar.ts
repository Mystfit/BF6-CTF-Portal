//==============================================================================================
// FLAG BAR UI CLASS - Displays flag positions and progress for two teams
//==============================================================================================

interface FlagBarParams {
    position: number[];
    size: number[];  // [width, height]
    parent: mod.UIWidget;
    team1: mod.Team;
    team2: mod.Team;
    team1CaptureZonePosition: mod.Vector;
    team2CaptureZonePosition: mod.Vector;
    barHeight?: number;  // Default: 16
    barSeperatorPadding?: number;
    flagIconSize?: number[];  // Default: [24, 24]
}

interface FlagBarState {
    targetProgress: number;   // Target position (0-1)
    currentProgress: number;  // Current animated position (0-1)
    velocity: number;         // For smooth dampening
}

class FlagBar {
    private readonly params: FlagBarParams;
    private rootContainer: mod.UIWidget;
    
    // Team bars (TickerWidget containers)
    private team1Bar: TickerWidget;
    private team2Bar: TickerWidget;
    
    // Flag icons
    private team1FlagIcon: FlagIcon;
    private team2FlagIcon: FlagIcon;
    
    // Flag states for smooth animation
    private team1FlagState: FlagBarState;
    private team2FlagState: FlagBarState;
    
    // Teams
    private readonly team1: mod.Team;
    private readonly team2: mod.Team;
    private readonly team1Id: number;
    private readonly team2Id: number;
    
    // Dimensions
    private readonly barWidth: number;
    private readonly barHeight: number;
    private readonly halfBarWidth: number;
    private readonly flagIconSize: number[];
    private readonly barSeperatorSize: number;
    
    constructor(params: FlagBarParams) {
        this.params = params;
        this.team1 = params.team1;
        this.team2 = params.team2;
        this.team1Id = mod.GetObjId(this.team1);
        this.team2Id = mod.GetObjId(this.team2);
        this.barSeperatorSize = this.params.barSeperatorPadding ?? 24;
        this.barWidth = params.size[0] - this.barSeperatorSize;
        this.barHeight = params.barHeight ?? 16;
        this.halfBarWidth = this.barWidth / 2;
        this.flagIconSize = params.flagIconSize ?? [24, 24];
        
        // Initialize flag states
        this.team1FlagState = {
            targetProgress: 0.0,
            currentProgress: 0.0,
            velocity: 0.0
        };
        
        this.team2FlagState = {
            targetProgress: 0.0,
            currentProgress: 0.0,
            velocity: 0.0
        };
        
        // Create root container
        this.rootContainer = this.createRootContainer();
        
        // Create team bars
        this.team1Bar = this.createTeamBar(this.team1, true);
        this.team2Bar = this.createTeamBar(this.team2, false);
        
        // Create flag icons
        this.team1FlagIcon = this.createFlagIcon(this.team1, this.team1Id);
        this.team2FlagIcon = this.createFlagIcon(this.team2, this.team2Id);
    }
    
    private createRootContainer(): mod.UIWidget {
        return modlib.ParseUI({
            type: "Container",
            parent: this.params.parent,
            position: this.params.position,
            size: [this.barWidth, this.barHeight],
            anchor: mod.UIAnchor.TopCenter,
            bgAlpha: 0  // Transparent background
        })!;
    }
    
    private createTeamBar(team: mod.Team, isLeftSide: boolean): TickerWidget {
        const teamId = mod.GetObjId(team);
        const teamColor = GetTeamColorById(teamId);
        
        // Position bars side by side
        const xPos = isLeftSide ? (-this.halfBarWidth / 2) - this.barSeperatorSize : (this.halfBarWidth / 2) + this.barSeperatorSize;
        
        // Create a simple TickerWidget subclass for the bar
        class FlagBarTicker extends TickerWidget {
            refresh(): void {
                // No refresh needed for flag bars
            }
        }

        const textColor = VectorClampToRange(
            GetTeamColorLight(team), 
            0, 
            1
        );
        
        return new FlagBarTicker({
            position: [xPos, 0],
            size: [this.halfBarWidth, this.barHeight],
            parent: this.rootContainer,
            textSize: 0,  // No text
            textColor: textColor,
            bgColor: teamColor,
            bgAlpha: 0.5,
            showProgressBar: true,
            progressValue: 1.0,  // Start full
            progressDirection: isLeftSide ? 'right' : 'left'
        });
    }
    
    private createFlagIcon(team: mod.Team, teamId: number): FlagIcon {
        const teamColor = GetTeamColorById(teamId);
        
        return new FlagIcon({
            name: `FlagBar_FlagIcon_Team${teamId}`,
            position: mod.CreateVector(0, 0, 0),
            size: mod.CreateVector(this.flagIconSize[0], this.flagIconSize[1], 0),
            anchor: mod.UIAnchor.Center,
            parent: this.rootContainer,
            bgFill: mod.UIBgFill.Solid,
            fillColor: mod.Add(teamColor, mod.CreateVector(0.5, 0.5, 0.5)),
            fillAlpha: 1,
            outlineColor: teamColor,
            outlineThickness: 1,
            showFill: true,
            showOutline: true,
            visible: true
        });
    }
    
    /**
     * Main update method - called from ClassicCTFScoreHUD refresh (1Hz SlowUpdate)
     */
    public update(flags: Map<number, Flag>, deltaTime: number = 1.0): void {
        // Get flags for each team
        const team1Flag = flags.get(this.team1Id);
        const team2Flag = flags.get(this.team2Id);
        
        if (team1Flag) {
            this.updateFlagState(
                team1Flag,
                this.team1FlagState,
                this.team1FlagIcon,
                this.team1Bar,
                this.params.team2CaptureZonePosition,
                true,
                deltaTime
            );
        }
        
        if (team2Flag) {
            this.updateFlagState(
                team2Flag,
                this.team2FlagState,
                this.team2FlagIcon,
                this.team2Bar,
                this.params.team1CaptureZonePosition,
                false,
                deltaTime
            );
        }
    }
    
    /**
     * Update a single flag's state and position
     */
    private updateFlagState(
        flag: Flag,
        flagState: FlagBarState,
        flagIcon: FlagIcon,
        opposingBar: TickerWidget,
        captureZonePosition: mod.Vector,
        isLeftTeam: boolean,
        deltaTime: number
    ): void {
        // Calculate target progress
        flagState.targetProgress = this.calculateFlagProgress(flag, captureZonePosition);
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Team ${flag.teamId} flag state: isAtHome=${flag.isAtHome}, isCarried=${flag.isBeingCarried}, isDropped=${flag.isDropped}`);
            //console.log(`[FlagBar] Team ${flag.teamId} targetProgress: ${flagState.targetProgress.toFixed(3)}`);
        }
        
        // Apply smooth damping
        this.smoothDampProgress(flagState, deltaTime);
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Team ${flag.teamId} currentProgress after damping: ${flagState.currentProgress.toFixed(3)}`);
        }
        
        // Update flag icon position
        this.updateFlagIconPosition(flagIcon, flagState.currentProgress, isLeftTeam);
        
        // Update flag icon visibility based on flag state
        // FIXED: Show flag when NOT dropped (was reversed)
        if (flag.isDropped) {
            //if (DEBUG_MODE) console.log(`[FlagBar] Team ${flag.teamId} flag is DROPPED, setting alpha to 0.0`);
            flagIcon.SetFillAlpha(0.15);
            flagIcon.SetOutlineAlpha(0.75);           
        } else {
            //if (DEBUG_MODE) console.log(`[FlagBar] Team ${flag.teamId} flag is NOT dropped, setting alpha to 1.0`);
            flagIcon.SetFillAlpha(1);
            flagIcon.SetOutlineAlpha(1);
        }
        
        // Update bar progress (bar empties as flag advances). 
        // Bar at twice the distance of the flag process so we empty it at the moment the flag hits the middle
        const barProgress = 1.0 - flagState.currentProgress * 2;
        opposingBar.setProgressValue(barProgress);
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Team ${flag.teamId} opposing bar progress: ${barProgress.toFixed(3)}`);
        }
    }
    
    /**
     * Calculate flag progress from home (0.0) to enemy capture zone (1.0)
     * Uses vector projection to ensure progress only increases when moving toward capture zone
     */
    private calculateFlagProgress(flag: Flag, captureZonePosition: mod.Vector): number {
        if (flag.isAtHome) {
            //if (DEBUG_MODE) console.log(`[FlagBar] Flag ${flag.teamId} is at home, progress = 0.0`);
            return 0.0;
        }
        
        const homePos = flag.homePosition;
        const currentPos = flag.currentPosition;
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Flag ${flag.teamId} homePos: ${VectorToString(homePos)}`);
            //console.log(`[FlagBar] Flag ${flag.teamId} currentPos: ${VectorToString(currentPos)}`);
            //console.log(`[FlagBar] Flag ${flag.teamId} captureZonePos: ${VectorToString(captureZonePosition)}`);
        }
        
        // Vector from home to capture zone (the direction we want to measure progress along)
        const homeToCaptureVec = Math2.Vec3.FromVector(captureZonePosition)
            .Subtract(Math2.Vec3.FromVector(homePos));
        
        // Vector from home to current position
        const homeToCurrentVec = Math2.Vec3.FromVector(currentPos)
            .Subtract(Math2.Vec3.FromVector(homePos));
        
        // Calculate the total distance from home to capture zone using proper vector length
        const totalDistanceSquared = (homeToCaptureVec.x * homeToCaptureVec.x) +
                                    (homeToCaptureVec.y * homeToCaptureVec.y) +
                                    (homeToCaptureVec.z * homeToCaptureVec.z);
        
        const totalDistance = Math.sqrt(totalDistanceSquared);
        
        if (totalDistance < 0.01) {
            // Capture zone is at the same position as home (edge case)
            //if (DEBUG_MODE) console.log(`[FlagBar] Flag ${flag.teamId} capture zone at home position, progress = 0.0`);
            return 0.0;
        }
        
        // Project current position onto the home-to-capture line
        // This gives us the distance along the line toward the capture zone
        const dotProduct = (homeToCurrentVec.x * homeToCaptureVec.x) +
                          (homeToCurrentVec.y * homeToCaptureVec.y) +
                          (homeToCurrentVec.z * homeToCaptureVec.z);
        
        const projectedDistance = dotProduct / totalDistance;
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Flag ${flag.teamId} totalDistance: ${totalDistance.toFixed(2)}`);
            //console.log(`[FlagBar] Flag ${flag.teamId} dotProduct: ${dotProduct.toFixed(2)}`);
            //console.log(`[FlagBar] Flag ${flag.teamId} projectedDistance: ${projectedDistance.toFixed(2)}`);
        }
        
        // Normalize progress to [0, 1] range
        // - If projectedDistance < 0, flag is behind home (moving away), clamp to 0
        // - If projectedDistance > totalDistance, flag is past capture zone, clamp to 1
        const progress = Math.max(0.0, Math.min(1.0, projectedDistance / totalDistance));
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] Flag ${flag.teamId} calculated progress: ${progress.toFixed(3)}`);
        }
        
        return progress;
    }
    
    /**
     * Apply smooth damping to progress for smooth animation
     * Uses a damped spring algorithm with 2 second smooth time
     */
    private smoothDampProgress(flagState: FlagBarState, deltaTime: number): void {
        const smoothTime = 2.0;  // 2 seconds to reach target
        
        // Damped spring calculation
        const omega = 2.0 / smoothTime;
        const x = omega * deltaTime;
        const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
        
        const change = flagState.currentProgress - flagState.targetProgress;
        const temp = (flagState.velocity + omega * change) * deltaTime;
        
        flagState.velocity = (flagState.velocity - omega * temp) * exp;
        flagState.currentProgress = flagState.targetProgress + (change + temp) * exp;
        
        // Clamp to valid range
        flagState.currentProgress = Math.max(0.0, Math.min(1.0, flagState.currentProgress));
    }
    
    /**
     * Update flag icon position based on progress
     * Progress 0.0: Flag at far end of own bar
     * Progress 0.5: Flag at center (between bars)
     * Progress 1.0: Flag at far end of enemy bar
     */
    private updateFlagIconPosition(
        flagIcon: FlagIcon,
        progress: number,
        isLeftTeam: boolean
    ): void {
        // Calculate position across the entire bar width
        // For left team: 0.0 progress = left edge, 1.0 progress = right edge
        // For right team: 0.0 progress = right edge, 1.0 progress = left edge
        
        let xPos: number;
        
        if (isLeftTeam) {
            // Left team flag moves from left (-halfBarWidth) to right (+halfBarWidth)
            xPos = -this.halfBarWidth + (this.flagIconSize[0] * 0.5) - this.barSeperatorSize + (progress * this.barWidth);
        } else {
            // Right team flag moves from right (+halfBarWidth) to left (-halfBarWidth)
            xPos = this.halfBarWidth - (this.flagIconSize[0] * 0.5) + this.barSeperatorSize - (progress * this.barWidth);
        }
        
        // Center vertically
        const yPos = 3;
        
        if (DEBUG_MODE) {
            //console.log(`[FlagBar] ${isLeftTeam ? 'Left' : 'Right'} team flag position: x=${xPos.toFixed(2)}, y=${yPos}, progress=${progress.toFixed(3)}`);
            //console.log(`[FlagBar] Bar dimensions: halfBarWidth=${this.halfBarWidth.toFixed(2)}, barWidth=${this.barWidth.toFixed(2)}`);
        }
        
        flagIcon.SetPosition(mod.CreateVector(xPos, yPos, 0));
    }
    
    /**
     * Clean up all UI widgets
     */
    public destroy(): void {
        this.team1FlagIcon.Destroy();
        this.team2FlagIcon.Destroy();
        mod.DeleteUIWidget(this.rootContainer);
    }
}
