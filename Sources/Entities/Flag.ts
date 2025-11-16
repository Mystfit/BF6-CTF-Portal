//==============================================================================================
// FLAG CLASS
//==============================================================================================

/**
 * Flag-specific event map defining all possible flag events and their data
 */
interface FlagEventMap {
    /** Emitted when a flag is picked up by a player */
    'flagTaken': { 
        flag: Flag; 
        player: mod.Player;
        isAtHome: boolean;  // Was the flag taken from home or picked up after being dropped?
    };
    
    /** Emitted when a flag is dropped by a player */
    'flagDropped': { 
        flag: Flag; 
        position: mod.Vector;
        previousCarrier: mod.Player | null;
    };
    
    /** Emitted when a flag is returned to its home position */
    'flagReturned': { 
        flag: Flag;
        player: mod.Player | undefined    // Player that returned the flag. Null if auto returned
    };
    
    /** Emitted when a flag reaches its home position (same as return, but separate for clarity) */
    'flagAtHome': { 
        flag: Flag;
    };
    
    /** Emitted when a flag's state changes in any way */
    'flagStateChanged': {
        flag: Flag;
        isAtHome: boolean;
        isBeingCarried: boolean;
        isDropped: boolean;
    };
    'flagCaptured': {
        flag: Flag;
        player: mod.Player;
    };
}


class Flag {
    readonly flagId: number;
    readonly owningTeamId: number;
    readonly allowedCapturingTeams: number[];
    customColor?: mod.Vector;
    
    readonly team: mod.Team;
    readonly teamId: number;
    readonly homePosition: mod.Vector;

    // Flag position
    currentPosition: mod.Vector;
    followPoints: mod.Vector[];
    followDelay: number;   // Number of points to cache for flag to follow
    
    // Smoothed values for exponential averaging
    smoothedPosition: mod.Vector;
    smoothedRotation: mod.Vector;
    
    // State
    isAtHome: boolean = true;
    isBeingCarried: boolean = false;
    isDropped: boolean = false;
    canBePickedUp: boolean = true;
    numFlagTimesPickedUp:number = 0;
    
    // Player tracking
    carrierPlayer: mod.Player | null = null;
    lastCarrier: mod.Player | null = null;
    
    // Timers
    dropTime: number = 0;
    autoReturnTime: number = 0;
    
    // Game objects
    flagRecoverIcon: mod.WorldIcon;
    flagCarriedIcons: Map<number, mod.WorldIcon> = new Map(); // One icon per opposing team
    flagInteractionPoint: mod.InteractPoint | null = null;
    flagProp: mod.Object | null = null;

    // WorldIcon manager IDs for tracking
    recoverIconId: string = '';
    carriedIconIds: Map<number, string> = new Map();

    // VFX
    flagSmokeVFX: mod.VFX;
    tetherFlagVFX: mod.VFX | null = null;
    tetherPlayerVFX: mod.VFX | null = null;
    hoverVFX: mod.VFX | null = null;
    pickupChargingVFX: mod.VFX | null = null;
    pickupAvailableVFX: mod.VFX | null = null;
    flagImpactVFX: mod.VFX | null = null;
    flagSparksVFX: mod.VFX | null = null;

    // VFX manager IDs for tracking
    smokeVFXId: string = '';
    sparksVFXId: string = '';
    impactVFXId: string = '';

    // SFX
    alarmSFX : mod.SFX | null = null;
    dragSFX: mod.SFX | null = null;
    pickupTimerStartSFX:mod.SFX | null = null;
    pickupTimerRiseSFX:mod.SFX | null = null;
    pickupTimerStopSFX:mod.SFX | null = null;

    // Event system
    readonly events: EventDispatcher<FlagEventMap>;
    
    constructor(
        team: mod.Team, 
        homePosition: mod.Vector,
        flagId?: number,
        allowedCapturingTeams?: number[],
        customColor?: mod.Vector
    ) {
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.owningTeamId = this.teamId;
        this.flagId = flagId ?? this.teamId; // Default to team ID for backwards compatibility
        this.allowedCapturingTeams = allowedCapturingTeams ?? []; // Empty = all opposing teams
        this.customColor = customColor;
        this.homePosition = homePosition;
        this.currentPosition = homePosition;
        this.smoothedPosition = homePosition;
        this.smoothedRotation = ZERO_VEC;
        this.followPoints = [];
        this.followDelay = 10;
        this.flagInteractionPoint = null;
        this.flagRecoverIcon = null as any; // Will be created in Initialize()
        this.flagProp = null;
        this.flagSmokeVFX = null as any; // Will be created in Initialize()
        this.dragSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Levels_Brooklyn_Shared_Spots_MetalStress_OneShot3D, this.homePosition, ZERO_VEC);
        this.hoverVFX = null; //mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Missile_Javelin, this.homePosition, ZERO_VEC);
        this.pickupChargingVFX = null; //mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Gadget_InterativeSpectator_Camera_Light_Red, this.homePosition, ZERO_VEC);
        this.pickupAvailableVFX = null; //mod.SpawnObject(mod.RuntimeSpawn_Common.FX_Gadget_InterativeSpectator_Camera_Light_Green, this.homePosition, ZERO_VEC);
        this.flagImpactVFX = null as any; // Will be created in Initialize()
        this.flagSparksVFX = null as any; // Will be created in Initialize()

        this.pickupTimerStartSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_AltRecoveringCacheStart_OneShot2D, this.homePosition, ZERO_VEC);
        this.pickupTimerRiseSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_AltRecoveringCacheTimer_OneShot2D, this.homePosition, ZERO_VEC);
        this.pickupTimerStopSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_AltRecoveringCacheStop_OneShot2D, this.homePosition, ZERO_VEC);
        
        // Initialize event system
        this.events = new EventDispatcher<FlagEventMap>();

        this.Initialize();
    }

    Initialize(): void {
        // Register WorldIcons with WorldIconManager
        const iconMgr = worldIconManager;

        // Create recover icon (shown to flag's team)
        this.recoverIconId = `flag_${this.flagId}_recover`;
        this.flagRecoverIcon = iconMgr.createIcon(
            this.recoverIconId,
            ZERO_VEC,
            {
                icon: mod.WorldIconImages.Flag,
                iconEnabled: false,
                textEnabled: false,
                color: this.GetFlagColor(),
                teamOwner: this.team
            }
        );

        // Create one carried icon per opposing team
        const opposingTeams = GetOpposingTeamsForFlag(this);
        for (const opposingTeamId of opposingTeams) {
            const opposingTeam = teams.get(opposingTeamId);
            if (opposingTeam) {
                const carriedIconId = `flag_${this.flagId}_carried_team${opposingTeamId}`;
                const carriedIcon = iconMgr.createIcon(
                    carriedIconId,
                    ZERO_VEC,
                    {
                        icon: mod.WorldIconImages.Flag,
                        iconEnabled: false,
                        textEnabled: false,
                        color: this.GetFlagColor(),
                        teamOwner: opposingTeam
                    }
                );
                this.flagCarriedIcons.set(opposingTeamId, carriedIcon);
                this.carriedIconIds.set(opposingTeamId, carriedIconId);
            }
        }

        // Register VFX with VFXManager
        const vfxMgr = vfxManager;

        // Create flag smoke VFX (main visual indicator)
        this.smokeVFXId = `flag_${this.flagId}_smoke`;
        this.flagSmokeVFX = vfxMgr.createVFX(
            this.smokeVFXId,
            mod.RuntimeSpawn_Common.FX_Smoke_Marker_Custom,
            this.homePosition,
            ZERO_VEC,
            {
                color: this.GetFlagColor(),
                enabled: true
            }
        );

        // Create flag sparks VFX (pickup ready indicator)
        this.sparksVFXId = `flag_${this.flagId}_sparks`;
        this.flagSparksVFX = vfxMgr.createVFX(
            this.sparksVFXId,
            mod.RuntimeSpawn_Common.FX_BASE_Sparks_Pulse_L,
            this.homePosition,
            ZERO_VEC,
            {
                enabled: false // Disabled until flag is ready to pickup
            }
        );

        // Create flag impact VFX (drop impact effect)
        this.impactVFXId = `flag_${this.flagId}_impact`;
        this.flagImpactVFX = vfxMgr.createVFX(
            this.impactVFXId,
            mod.RuntimeSpawn_Common.FX_Impact_LootCrate_Generic,
            this.homePosition,
            ZERO_VEC,
            {
                enabled: false // Only enabled briefly on drop
            }
        );

        // Note: VFX are now refreshed on first player deploy using VFXManager
        // This is handled by vfxManager.refreshAllVFX() in OnPlayerDeployed

        // Set up flag at home position
        this.SpawnFlagAtHome();

        if (DEBUG_MODE) {
            console.log(`Flag initialized for team ${this.teamId} at position: ${VectorToString(this.homePosition)}`);
        }
    }

    SpawnFlagAtHome(): void {
        this.isAtHome = true;
        this.isBeingCarried = false;
        this.isDropped = false;
        this.canBePickedUp = true;
        this.currentPosition = this.homePosition;
        this.carrierPlayer = null;

        // Spawn flag slightly above spawner prop to avoid collision
        let flagOffset = mod.CreateVector(0.0, 0.1, 0.0);
        
        // Spawn flag prop at home
        if (this.flagProp && mod.GetObjId(this.flagProp) > 0) {
            mod.UnspawnObject(this.flagProp);
        }
        
        // Enable flag VFX using VFXManager
        const vfxMgr = vfxManager;
        vfxMgr.setColor(this.smokeVFXId, GetTeamColor(this.team));
        vfxMgr.setEnabled(this.smokeVFXId, true);
        vfxMgr.setPosition(this.smokeVFXId, this.currentPosition, ZERO_VEC);

        this.flagProp = mod.SpawnObject(
            FLAG_PROP, 
            mod.Add(this.homePosition, flagOffset),
            ZERO_VEC
        );

        // If we're using an MCOM, disable it to hide the objective marker
        let mcom: mod.MCOM = this.flagProp as mod.MCOM;
        if(mcom)
            mod.EnableGameModeObjective(mcom, false);
        
        // Update defend icons for all opposing teams using WorldIconManager
        const iconMgr = worldIconManager;
        for (const [teamId, iconId] of this.carriedIconIds.entries()) {
            iconMgr.setColor(iconId, GetTeamColor(this.team));
            iconMgr.setIcon(iconId, mod.WorldIconImages.Flag);
            iconMgr.setText(iconId, mod.Message(mod.stringkeys.pickup_flag_label));
            iconMgr.setEnabled(iconId, false, false); // Hide both icon and text
        }

        // Update recover icon using WorldIconManager
        iconMgr.setColor(this.recoverIconId, GetTeamColor(this.team));
        iconMgr.setIcon(this.recoverIconId, mod.WorldIconImages.Flag);
        iconMgr.setText(this.recoverIconId, mod.Message(mod.stringkeys.recover_flag_label));
        iconMgr.setEnabled(this.recoverIconId, false, false); // Hide both icon and text

        // Update interaction point
        this.UpdateFlagInteractionPoint();
    }
    
    PickupFlag(player: mod.Player): void {
        if (!this.canBePickedUp) {
            if (DEBUG_MODE) {
                console.log("Flag cannot be picked up yet (delay active)");
                mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_pickup_delay));
            }
            return;
        }
        
        if(!CARRIER_CAN_HOLD_MULTIPLE_FLAGS && IsCarryingAnyFlag(player)){
            if(DEBUG_MODE)
                mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.player_already_holding_flag));
            return;
        }

        // Store initial state for event
        const wasAtHome = this.isAtHome;

        // Play spawner sound alarm
        if(this.isAtHome){
            this.PlayFlagAlarm().then(() => console.log("Flag alarm stopped"));
        }

        // Set flag state
        this.numFlagTimesPickedUp += 1;
        this.isAtHome = false;
        this.isBeingCarried = true;
        this.isDropped = false;
        this.carrierPlayer = player;
        this.lastCarrier = player;

        // Play VO voice lines
        this.PlayFlagTakenVO();

        // Play pickup SFX
        let pickupSfxOwner: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_EnemyPickedUpCache_OneShot2D, this.homePosition, ZERO_VEC);
        mod.PlaySound(pickupSfxOwner, 1, this.team);
        for(let teamID of GetOpposingTeamsForFlag(this)){
            let pickupSfxCapturer: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gauntlet_Heist_FriendlyCapturedCache_OneShot2D, this.homePosition, ZERO_VEC);
            mod.PlaySound(pickupSfxCapturer, 1, mod.GetTeam(teamID));
        }

        // Disable VFX
        if(this.pickupAvailableVFX){
            mod.EnableVFX(this.pickupAvailableVFX, false); 
        }

        // Remove flag prop
        if(!FLAG_FOLLOW_MODE){
            if (this.flagProp) {
                mod.UnspawnObject(this.flagProp);
                this.flagProp = null;
            }
        } else {
            this.tetherFlagVFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_WireGuidedMissile_SpooledWire, this.currentPosition, ZERO_VEC) as mod.VFX;
            this.tetherPlayerVFX = mod.SpawnObject(mod.RuntimeSpawn_Common.FX_WireGuidedMissile_SpooledWire, this.currentPosition, ZERO_VEC) as mod.VFX;
            mod.EnableVFX(this.tetherFlagVFX, true);
            mod.EnableVFX(this.tetherPlayerVFX, true);
        }

        // Make sure to clear follow buffer so we get new points
        this.followPoints = [];

        // Flag carriers need updated weapons
        this.RestrictCarrierWeapons(player);

        // Spot the target on the minimap indefinitely
        mod.SpotTarget(this.carrierPlayer, mod.SpotStatus.SpotInMinimap);
        
        // Show all carried icons for opposing teams using WorldIconManager
        const iconMgr = worldIconManager;
        for (const [teamId, iconId] of this.carriedIconIds.entries()) {
            iconMgr.setEnabled(iconId, true, true); // Show both icon and text
        }
        iconMgr.setEnabled(this.recoverIconId, true, true); // Show both icon and text

        // Set VFX properties using VFXManager
        vfxManager.setColor(this.smokeVFXId, GetTeamColor(this.team));

        // Notify all players
        const message = mod.Message(mod.stringkeys.team_flag_taken, GetTeamName(this.team));
        if(DEBUG_MODE)
            mod.DisplayHighlightedWorldLogMessage(message);

        // Remove roaming flag interaction point
        if(this.flagInteractionPoint){
            mod.UnspawnObject(this.flagInteractionPoint);
        }
        
        // Emit flag taken event
        this.events.emit('flagTaken', {
            flag: this,
            player: player,
            isAtHome: wasAtHome
        });
        
        // Emit state changed event
        this.events.emit('flagStateChanged', {
            flag: this,
            isAtHome: this.isAtHome,
            isBeingCarried: this.isBeingCarried,
            isDropped: this.isDropped
        });
        
        if (DEBUG_MODE) {
            const carrierTeam = mod.GetTeam(this.carrierPlayer);
            const carrierTeamId = mod.GetObjId(carrierTeam);
            console.log(`Flag picked up by player on team ${carrierTeamId}`);
        }
    }
    
    async DropFlag(position?: mod.Vector, direction?: mod.Vector, dropDistance: number = FLAG_DROP_DISTANCE, useProjectileThrow?: boolean): Promise<void> {
        if (!this.isBeingCarried) return;

        // Store previous carrier for event
        const previousCarrier = this.carrierPlayer;

        this.isAtHome = false;
        this.isBeingCarried = false;
        this.isDropped = true;
        this.canBePickedUp = false;
        useProjectileThrow = useProjectileThrow ?? FLAG_ENABLE_ARC_THROW;
        let facingDir: mod.Vector = ZERO_VEC;
        let throwDirectionAndSpeed: mod.Vector = ZERO_VEC;
        let startRaycastID: number = RaycastManager.GetID();    // For debugging how many rays we're using

        // Determine drop position and direction
        if(this.carrierPlayer){
            let soldierPosition = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetPosition);
            facingDir = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetFacingDirection);

            // Flatten player look direction so it is parallel to X and Z axis
            position = position ?? soldierPosition;
            direction = direction ?? mod.Normalize(mod.CreateVector(mod.XComponentOf(facingDir), 0, mod.ZComponentOf(facingDir)));
            
            // Get jsPlayer to obtain cached velocity
            let jsPlayer = JSPlayer.get(this.carrierPlayer);
            if(jsPlayer){
                throwDirectionAndSpeed = mod.Add(mod.Multiply(facingDir, FLAG_THROW_SPEED), jsPlayer.velocity);
            }

            this.RestoreCarrierWeapons(this.carrierPlayer);
            mod.RemoveUIIcon(this.carrierPlayer);

            // Unspot the carrier
            mod.SpotTarget(this.carrierPlayer, mod.SpotStatus.Unspot);
        } else {
            position = position ?? this.currentPosition;
            direction = direction ?? mod.DownVector();
            throwDirectionAndSpeed = mod.Multiply(direction, FLAG_THROW_SPEED);
        }
        
        // Remove old flag if it exists - it shouldn't but lets make sure
        if(!FLAG_FOLLOW_MODE){
            try{
                if (this.flagProp)
                    mod.UnspawnObject(this.flagProp);
            } catch(error: unknown){
                console.log("Couldn't unspawn flag prop");
            }
        } else {
            if(this.tetherFlagVFX && this.tetherPlayerVFX){
                mod.UnspawnObject(this.tetherFlagVFX);
                mod.UnspawnObject(this.tetherPlayerVFX);
            }
        }
       
        // Flag rotation based on facing direction
        // TODO: replace with facing angle and hit normal
        let flagRotationVec = Math2.Vec3.FromVector(facingDir).DirectionToEuler(); //mod.CreateVector(0, mod.ArctangentInRadians(mod.XComponentOf(direction) / mod.ZComponentOf(direction)), 0);
        let flagRotationFlat = new Math2.Vec3(0, flagRotationVec.y, 0);
        let flagRotation = flagRotationFlat.ToVector();

        // Initially spawn flag at carrier position - it will be moved by animation
        let initialPosition = position;
        
        if(!FLAG_FOLLOW_MODE){
            //this.flagProp = mod.SpawnObject(FLAG_PROP, initialPosition, flagRotation);
        }

        if(DEBUG_MODE) console.log("this.flagProp = mod.SpawnObject(FLAG_PROP, initialPosition, flagRotation);");

        // Play yeet SFX
        let yeetSfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Soldier_Ragdoll_OnDeath_OneShot3D, initialPosition, ZERO_VEC);
        mod.PlaySound(yeetSfx, 1);

        // Clear the carrierPlayer when the flag has left the player
        this.carrierPlayer = null;

        // Animate flag with concurrent raycast generation
        if(useProjectileThrow && !FLAG_FOLLOW_MODE) {
            if(DEBUG_MODE) console.log("Starting concurrent flag animation");
            
            // Create the generator for projectile path with validation callback
            const pathGenerator = RaycastManager.ProjectileRaycastGenerator(
                mod.Add(
                    mod.Add(mod.Add(position, mod.CreateVector(0.0, SOLDIER_HEIGHT, 0.0)), mod.Multiply(facingDir, 1.5)) ,     // Start above soldier head to avoid self collisions
                    mod.Multiply(facingDir, 0.75)        // Start projectile arc away from player to avoid intersections
                ),
                throwDirectionAndSpeed,                 // Velocity
                FLAG_DROP_RAYCAST_DISTANCE,             // Max drop distance
                4,                                      // Sample rate
                this.carrierPlayer,                     // Origin player (now null but was set earlier)
                9.8,                                    // gravity
                DEBUG_MODE,                             // Debug visualization
                5,                                      // Interpolation steps
                FLAG_TERRAIN_FIX_PROTECTION ? mod.YComponentOf(initialPosition) : undefined,    // Clamp Y distance arc can travel to fix terrain raycast bug
                async (hitPoint: mod.Vector, hitNormal?: mod.Vector) => {
                    // This callback is called when the projectile hits something
                    if(DEBUG_MODE) {
                        console.log(`[DropFlag] Hit detected at ${VectorToString(hitPoint)}, validating position`);
                    }
                    
                    // Move validation location slightly away from the hit location in direction of the hit normal
                    let groundLocationAdjusted: mod.Vector = mod.Add(
                        hitPoint, 
                        mod.Multiply(hitNormal ?? mod.UpVector(), SPAWN_VALIDATION_HEIGHT_OFFSET)
                    );
                    
                    // Adjust flag spawn location to make sure it's not clipping into a wall
                    const validatedFlagSpawn = await RaycastManager.ValidateSpawnLocationWithRadialCheck(
                        groundLocationAdjusted,             // Hit location, vertically adjusted upwards to avoid clipping into the ground plane
                        FLAG_COLLISION_RADIUS,              // Collision radius of the flag that is safe to spawn it in
                        FLAG_COLLISION_RADIUS_OFFSET,       // Offset to start rays from
                        SPAWN_VALIDATION_DIRECTIONS,        // How many direction rays to cast around the object
                        FLAG_DROP_RAYCAST_DISTANCE,         // How far down to look for a valid ground location
                        SPAWN_VALIDATION_MAX_ITERATIONS,    // Adjustment iterations, in case we don't find a valid location
                        DEBUG_MODE,                         // Debug
                        FLAG_TERRAIN_FIX_PROTECTION ? mod.YComponentOf(initialPosition) : undefined
                    );

                    let endRayCastID: number = RaycastManager.GetID();
                    if(DEBUG_MODE){
                        console.log(`Flag drop took ${endRayCastID - startRaycastID} raycasts to complete`);
                        if (!validatedFlagSpawn.isValid) {
                            console.log(`Warning: ValidateSpawnLocationWithRadialCheck could not find valid location`);
                        }
                    }

                    // Use the validated position if valid, otherwise use the hit point
                    return validatedFlagSpawn.isValid ? validatedFlagSpawn.position : hitPoint;
                }
            );

            // Animate concurrently with path generation
            await animationManager.AnimateAlongGeneratedPath(
                undefined,
                pathGenerator,
                20,  // minBufferSize - stay ahead of animation to avoid catching up during validation
                {
                    speed: 800,
                    onSpawnAtStart: ():mod.Object | null  => {
                        // Disable smoke whilst flag is thrown to avoid flare leaking out
                        vfxManager.setEnabled(this.smokeVFXId, false);

                        // Spawn prop
                        this.flagProp = mod.SpawnObject(FLAG_PROP, initialPosition, flagRotation);

                        // If we're using an MCOM, disable it to hide the objective marker
                        let mcom: mod.MCOM = this.flagProp as mod.MCOM;
                        if(mcom)
                            mod.EnableGameModeObjective(mcom, false);
                        
                        return this.flagProp;
                    },
                    onProgress: (progress: number, position: mod.Vector) => {
                    },
                    rotation: flagRotation
                }
            ).catch((reason: any) => {
                console.log(`Concurrent animation path failed with reason ${reason}`);
            });
            
            // Update current position to final animated position
            this.currentPosition = this.flagProp ? mod.GetObjectPosition(this.flagProp) : position;
            
            if(DEBUG_MODE) console.log("Concurrent flag animation complete");
        } else if(!useProjectileThrow) {
            // Fallback: just set position directly
            this.currentPosition = position;
            if(this.flagProp) {
                mod.SetObjectTransform(this.flagProp, mod.CreateTransform(this.currentPosition, flagRotation));
            }
        }

        // Play impact VFX using VFXManager
        vfxManager.setPosition(this.impactVFXId, this.currentPosition, ZERO_VEC);
        vfxManager.setEnabled(this.impactVFXId, true);

        // Update capture icons for all opposing teams using WorldIconManager
        const iconMgr = worldIconManager;
        let flagIconOffset = mod.Add(this.currentPosition, mod.CreateVector(0,2,0));
        for (const [teamId, iconId] of this.carriedIconIds.entries()) {
            iconMgr.setEnabled(iconId, true, true); // Show both icon and text
            iconMgr.setText(iconId, mod.Message(mod.stringkeys.pickup_flag_label));
            iconMgr.setPosition(iconId, flagIconOffset);
        }
        iconMgr.setEnabled(this.recoverIconId, true, true); // Show both icon and text
        iconMgr.setPosition(this.recoverIconId, flagIconOffset);

        // Update VFX using VFXManager
        vfxManager.setPosition(this.smokeVFXId, this.currentPosition, ZERO_VEC);
        vfxManager.setColor(this.smokeVFXId, GetTeamDroppedColor(this.team));

        // Play drop VO
        let friendlyVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
        if(friendlyVO){
            mod.PlayVO(friendlyVO, mod.VoiceOverEvents2D.ObjectiveContested, mod.VoiceOverFlags.Alpha, this.team);
        }

        // Start timers
        this.StartAutoReturn(FLAG_AUTO_RETURN_TIME, this.numFlagTimesPickedUp).then( () => {console.log(`Flag ${this.teamId} auto-returning to base`)});
        this.StartPickupDelay().then(() => {
            // Activate FX using VFXManager
            vfxManager.setEnabled(this.smokeVFXId, true);
            vfxManager.setPosition(this.sparksVFXId, this.currentPosition, ZERO_VEC);
            vfxManager.setEnabled(this.sparksVFXId, true);

            // Update the position of the flag interaction point
            this.UpdateFlagInteractionPoint();   
            
            console.log("Flag pickup delay complete");
        });
        
        // Emit flag dropped event
        this.events.emit('flagDropped', {
            flag: this,
            position: this.currentPosition,
            previousCarrier: previousCarrier
        });
        
        // Emit state changed event
        this.events.emit('flagStateChanged', {
            flag: this,
            isAtHome: this.isAtHome,
            isBeingCarried: this.isBeingCarried,
            isDropped: this.isDropped
        });
        
        if (DEBUG_MODE) {
            console.log(`Flag dropped`);
            mod.DisplayHighlightedWorldLogMessage(
            mod.Message(mod.stringkeys.flag_dropped, GetTeamName(this.team)));
        }

    }

    UpdateFlagInteractionPoint(){
        try{
            if(this.flagInteractionPoint){
                mod.UnspawnObject(this.flagInteractionPoint);
            }
        } catch(error: unknown){
            console.log("Interaction zone already unspawned");
        }
        console.log("Spawning updated interaction zone for flag");

        let flagInteractOffset = mod.Add(this.currentPosition, mod.CreateVector(0, FLAG_INTERACTION_HEIGHT_OFFSET, 0));
        this.flagInteractionPoint = mod.SpawnObject(mod.RuntimeSpawn_Common.InteractPoint, flagInteractOffset, ZERO_VEC);
        if(this.flagInteractionPoint){
            mod.EnableInteractPoint(this.flagInteractionPoint, true);
        }
    }
    
    async StartPickupDelay(): Promise<void> {
        let vfxHeightOffset = mod.CreateVector(0, 1.7, 0);

        // Lock the flag icons using WorldIconManager
        const iconMgr = worldIconManager;
        iconMgr.setIcon(this.recoverIconId, mod.WorldIconImages.Alert);
        iconMgr.setText(this.recoverIconId, mod.Message(mod.stringkeys.locked_flag_label));
        for(let [teamId, iconId] of this.carriedIconIds){
            iconMgr.setIcon(iconId, mod.WorldIconImages.Alert);
            iconMgr.setText(iconId, mod.Message(mod.stringkeys.locked_flag_label));
        }

        // Charging VFX
        if(this.pickupChargingVFX){
            mod.MoveVFX(this.pickupChargingVFX, mod.Add(this.currentPosition, vfxHeightOffset), ZERO_VEC);
            mod.EnableVFX(this.pickupChargingVFX, true); 
        }
        
        // Play drop SFX
        if(this.pickupTimerStartSFX && this.pickupTimerRiseSFX && this.lastCarrier){
            mod.PlaySound(this.pickupTimerStartSFX, 1);
            await mod.Wait(0.1);
            mod.PlaySound(this.pickupTimerRiseSFX, 1);
        }

        // Wait for flag timer to expire
        await mod.Wait(FLAG_PICKUP_DELAY);
        
        // Play final sound when flag is ready to pickup
        if(this.pickupTimerStopSFX)
            mod.PlaySound(this.pickupTimerStopSFX, 1);

        // Activate flag pickup VFX
        if(this.pickupChargingVFX && this.pickupAvailableVFX){
            mod.EnableVFX(this.pickupChargingVFX, false);
            mod.MoveVFX(this.pickupAvailableVFX, mod.Add(this.currentPosition, vfxHeightOffset), ZERO_VEC);
            mod.EnableVFX(this.pickupAvailableVFX, true); 
        }

        // Reset flag icons using WorldIconManager
        iconMgr.setText(this.recoverIconId, mod.Message(mod.stringkeys.recover_flag_label));
        iconMgr.setIcon(this.recoverIconId, mod.WorldIconImages.Flag);
        for(let [teamId, iconId] of this.carriedIconIds){
            iconMgr.setIcon(iconId, mod.WorldIconImages.Flag);
            iconMgr.setText(iconId, mod.Message(mod.stringkeys.pickup_flag_label));
        }

        if (this.isDropped) {
            this.canBePickedUp = true;
            this.lastCarrier = null;
        }
    }

    ReturnFlag(player?:mod.Player): void {
        if(DEBUG_MODE)
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.team_flag_returned));
        this.PlayFlagReturnedSFX();
        
        // Emit flag returned event (before reset)
        this.events.emit('flagReturned', {
            flag: this,
            player: player
        });
        
        this.ResetFlag();
    }
    
    ResetFlag(): void {
        if (this.carrierPlayer) {
            this.RestoreCarrierWeapons(this.carrierPlayer);
            mod.RemoveUIIcon(this.carrierPlayer);
        }
        
        if (this.flagProp) {
            mod.UnspawnObject(this.flagProp);
            this.flagProp = null;
        }

        // Disable VFX
        if(this.pickupAvailableVFX){
            mod.EnableVFX(this.pickupAvailableVFX, false); 
        }
        
        this.SpawnFlagAtHome();
        this.StopFlagAlarm();
        
        if (DEBUG_MODE) {
            console.log(`Team ${this.teamId} flag returned`);
            // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_returned, this.teamId));
        }
    }
    
    CheckAutoReturn(): void {
        if (!this.isDropped) return;
        
        const currentTime = GetCurrentTime();
        if (currentTime >= this.autoReturnTime) {
            if (DEBUG_MODE) {
                console.log(`Flag ${this.team} auto-returning to base`);
                //mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_auto_return));
            }
            
            this.ReturnFlag();
        }
    }

    async StartAutoReturn(returnDelay: number, expectedNumTimesPickedUp: number): Promise<void> {
        let currFlagTimesPickedUp = expectedNumTimesPickedUp;
        await mod.Wait(returnDelay);
        if(this.isDropped && !this.isBeingCarried && !this.isAtHome && currFlagTimesPickedUp === this.numFlagTimesPickedUp){
            console.log(`Flag auto return. Number of times returned ${this.numFlagTimesPickedUp}. Expected ${currFlagTimesPickedUp}`);
            
            this.PlayFlagReturnedSFX();

            // Emit flag returned event with auto-return flag
            this.events.emit('flagReturned', {
                flag: this,
                player: undefined
            });

            
            this.ResetFlag();
        }
    }

    SlowUpdate(timeDelta:number) {
        if(this.isDropped){
            let mcom: mod.MCOM = this.flagProp as mod.MCOM;
            if(mcom)
                mod.EnableGameModeObjective(mcom, false);
        }
    }

    FastUpdate(timeDelta:number) {
        if (this.isBeingCarried) {
            this.UpdateCarrier(timeDelta);
        }
    }
    
    UpdateCarrier(timeDelta: number): void {
        if (!this.isBeingCarried || !this.carrierPlayer) return;
        
        if (!mod.IsPlayerValid(this.carrierPlayer) || 
            !mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsAlive)) {
            return;
        }
        
        // Get the soldier position for attaching effects
        let currentSoldierPosition = mod.GetSoldierState(
            this.carrierPlayer, 
            mod.SoldierStateVector.GetPosition);
        let currentRotation = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetFacingDirection);
        let currentVelocity = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateVector.GetLinearVelocity);
        let soldierInAir = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsInAir);
        let soldierParachuting = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsParachuting);
        let soldierInVehicle = mod.GetSoldierState(this.carrierPlayer, mod.SoldierStateBool.IsInVehicle);

        // Update jsPlayer velocity
        let jsPlayer = JSPlayer.get(this.carrierPlayer);
        if(jsPlayer){
            jsPlayer.velocity = currentVelocity
        }

        if(FLAG_FOLLOW_MODE){
            this.FollowPlayer(currentSoldierPosition, soldierParachuting);
        } else {
            this.currentPosition = currentSoldierPosition;
        }
        
        // Make smoke effect follow carrier using VFXManager
        vfxManager.setPosition(this.smokeVFXId, this.currentPosition, currentRotation);

        if(this.hoverVFX){
            if(soldierParachuting){
                mod.EnableVFX(this.hoverVFX, true);
                mod.MoveVFX(this.hoverVFX, this.currentPosition, Math2.Vec3.FromVector(mod.ForwardVector()).DirectionToEuler().ToVector());
            } else {
                mod.EnableVFX(this.hoverVFX, false);
            }
        }

        // Move carrier icons
        this.UpdateCarrierIcon();

        // Force disable carrier weapons
        this.CheckCarrierDroppedFlag(this.carrierPlayer);
    }

    FollowPlayer(currentSoldierPosition: mod.Vector, isParachuting?: boolean) {
        let distanceToPlayer = Math2.Vec3.FromVector(currentSoldierPosition).Subtract(Math2.Vec3.FromVector(this.currentPosition)).Length();

        // Always add player position to buffer to maintain continuous path
        let currentFlagPos = Math2.Vec3.FromVector(this.currentPosition);
        let currentSoldierPos = Math2.Vec3.FromVector(currentSoldierPosition);
        let soldierToFlagDir = currentSoldierPos.Subtract(currentFlagPos);
        let soldierToFlagDirScaled = soldierToFlagDir.MultiplyScalar(0.85);
        let flagPositionScaled = currentFlagPos.Add(soldierToFlagDirScaled);
        let soldierParachuting = isParachuting ?? false;
        this.followPoints.push(flagPositionScaled.ToVector());

        // Keep buffer within max sample size
        if (this.followPoints.length > FLAG_FOLLOW_SAMPLES) {
            this.followPoints.shift(); // Remove oldest to maintain size
        }

        // Process buffer when we have minimum required points
        if (this.followPoints.length >= FLAG_FOLLOW_SAMPLES) {
            // Always consume one position per frame to keep buffer flowing
            let nextBufferPosition = this.followPoints.shift() ?? this.currentPosition;

            // Check if this position would maintain proper distance from player
            let distanceNextPosToPlayer = Math2.Vec3.FromVector(currentSoldierPosition).Subtract(Math2.Vec3.FromVector(nextBufferPosition)).Length();

            // Use hysteresis to prevent oscillation: stricter threshold to stop, looser to continue
            // This accounts for the dampening factor making positions closer to flag
            let minDistanceToMove = FLAG_FOLLOW_DISTANCE * 0.7; // Lower threshold to allow movement

            // Only move flag if position maintains safe distance
            if (distanceNextPosToPlayer > minDistanceToMove) {
                // Apply exponential smoothing to position
                // smoothedPosition = alpha * newPosition + (1 - alpha) * previousSmoothedPosition
                let targetPos = Math2.Vec3.FromVector(nextBufferPosition);
                let currentSmoothedPos = Math2.Vec3.FromVector(this.smoothedPosition);
                let smoothedPos = targetPos.MultiplyScalar(FLAG_FOLLOW_POSITION_SMOOTHING)
                    .Add(currentSmoothedPos.MultiplyScalar(1 - FLAG_FOLLOW_POSITION_SMOOTHING));
                
                this.smoothedPosition = smoothedPos.ToVector();
                this.currentPosition = this.smoothedPosition;

                // Calculate direction to next point for rotation
                let nextPosition = this.followPoints.length > 1 ? this.followPoints[0] : this.currentPosition;
                let direction = Math2.Vec3.FromVector(nextPosition).Subtract(Math2.Vec3.FromVector(this.currentPosition)).MultiplyScalar(-1).Normalize();

                // Remove pitch and roll if we're hovering
                direction = soldierParachuting ? direction.Multiply(new Math2.Vec3(1,0,1)).Normalize() : direction;
                let targetRotation = direction.Length() > 0.01 ? direction.DirectionToEuler() : new Math2.Vec3(0, 0, 0);
                
                // Apply exponential smoothing to rotation
                // smoothedRotation = alpha * newRotation + (1 - alpha) * previousSmoothedRotation
                let currentSmoothedRot = Math2.Vec3.FromVector(this.smoothedRotation);
                let smoothedRot = targetRotation.MultiplyScalar(FLAG_FOLLOW_ROTATION_SMOOTHING)
                    .Add(currentSmoothedRot.MultiplyScalar(1 - FLAG_FOLLOW_ROTATION_SMOOTHING));
                
                this.smoothedRotation = smoothedRot.ToVector();

                if (this.flagProp) {
                    mod.SetObjectTransform(this.flagProp, mod.CreateTransform(this.smoothedPosition, this.smoothedRotation));

                    if (this.dragSFX) {
                        mod.PlaySound(this.dragSFX, 1);
                    }
                }

                if(this.tetherFlagVFX && this.tetherPlayerVFX){
                    mod.MoveVFX(this.tetherFlagVFX, this.smoothedPosition, soldierToFlagDir.DirectionToEuler().ToVector());
                    //mod.SetVFXScale(this.tetherFlagVFX, 2);

                    let playerToFlagRot = smoothedPos.Subtract(currentSoldierPos).DirectionToEuler();
                    mod.MoveVFX(this.tetherPlayerVFX, currentSoldierPosition, playerToFlagRot.ToVector());
                    // mod.SetVFXScale(this.tetherPlayerVFX, 2);
                }
            }
            // If position is too close, we consumed it but didn't move - flag stays at currentPosition
        }
    }

    UpdateCarrierIcon(){
        // Move flag icons for all opposing teams using WorldIconManager
        const iconMgr = worldIconManager;
        let flagIconOffset = mod.Add(this.currentPosition, mod.CreateVector(0,2.5,0));
        const shouldShowIcon = this.isBeingCarried || this.isDropped;

        for (const [teamId, iconId] of this.carriedIconIds.entries()) {
            iconMgr.setPosition(iconId, flagIconOffset);
            iconMgr.setIconEnabled(iconId, shouldShowIcon);
        }
        iconMgr.setPosition(this.recoverIconId, flagIconOffset);
        iconMgr.setIconEnabled(this.recoverIconId, shouldShowIcon);
    }
    
    RestrictCarrierWeapons(player: mod.Player): void {
        // Force equip sledgehammer
        if(CARRIER_FORCED_WEAPON)
            mod.AddEquipment(player, CARRIER_FORCED_WEAPON);

        if(!mod.IsInventorySlotActive(player, CARRIER_FORCED_WEAPON_SLOT)){
            mod.ForceSwitchInventory(player, CARRIER_FORCED_WEAPON_SLOT);
        }
        
        if (DEBUG_MODE) {
            console.log(`${player} weapons restricted`);
        }
    }

    CheckCarrierDroppedFlag(player: mod.Player): void {
        if(this.carrierPlayer){
            if(mod.GetObjId(this.carrierPlayer) == mod.GetObjId(player)){
                if(!mod.IsInventorySlotActive(player, CARRIER_FORCED_WEAPON_SLOT)){
                    this.DropFlag();
                }
            }
        }
    }
    
    RestoreCarrierWeapons(player: mod.Player): void {
        // Note: In a full implementation, you'd want to track and restore the player's original loadout
        mod.AddEquipment(player, mod.Gadgets.Melee_Combat_Knife);
        mod.ForceSwitchInventory(player, mod.InventorySlots.PrimaryWeapon);

        if (DEBUG_MODE) {
            console.log(`${mod.GetObjId(player)} Carrier weapons restored`);
            // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.carrier_weapons_restored));
        }
    }
    
    IsPlayerOnThisTeam(player: mod.Player): boolean {
        return mod.GetObjId(mod.GetTeam(player)) === this.teamId;
    }
    
    // New multi-team helper methods
    CanBePickedUpBy(playerTeamId: number): boolean {
        // Can't pick up your own team's flag
        if (this.owningTeamId === playerTeamId) return false;
        
        // Check whitelist if specified
        if (this.allowedCapturingTeams.length > 0) {
            return this.allowedCapturingTeams.includes(playerTeamId);
        }
        
        // Empty whitelist = any opposing team can capture
        return true;
    }
    
    GetFlagColor(): mod.Vector {
        // Use custom color if specified, otherwise use owning team's color
        if (this.customColor) return this.customColor;
        return GetTeamColorById(this.owningTeamId);
    }

    async PlayFlagAlarm(): Promise<void>{
        this.alarmSFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Alarm, this.currentPosition, ZERO_VEC);
        if(this.alarmSFX){
            // mod.EnableSFX(this.alarmSFX, true);
            mod.PlaySound(this.alarmSFX, 1, this.currentPosition, 100);
        }
        // Stop flag sound after a duration
        await mod.Wait(FLAG_SFX_DURATION);
        this.StopFlagAlarm();
    }

    PlayFlagTakenVO(){
        let vo_flag = DEFAULT_TEAM_VO_FLAGS.get(this.teamId);

        // Play VO for flag owning team
        let flagOwningTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
        if(flagOwningTeamVO && vo_flag){
            mod.PlayVO(flagOwningTeamVO, mod.VoiceOverEvents2D.ObjectiveLost, vo_flag, this.team);
        }
        
        // Play VO for all opposing teams
        if(this.carrierPlayer && vo_flag){
            let carrierTeam:mod.Team = mod.GetTeam(this.carrierPlayer);
            if (carrierTeam) {
                let capturingTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
                if(capturingTeamVO && vo_flag){
                    mod.PlayVO(capturingTeamVO, mod.VoiceOverEvents2D.ObjectiveLockdownFriendly, vo_flag, carrierTeam);
                }
            }
        }
    }

    StopFlagAlarm(){
        if(this.alarmSFX){
            mod.StopSound(this.alarmSFX);
        }
    }

    PlayFlagReturnedSFX(){
        let vo_flag = DEFAULT_TEAM_VO_FLAGS.get(this.teamId);

        // Play returned SFX
        let pickupSfx: mod.SFX = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_ObjetiveUnlockReveal_OneShot2D, this.homePosition, ZERO_VEC);
        // mod.EnableSFX(pickupSfx, true);
        mod.PlaySound(pickupSfx, 1);

        // Play VO for flag owning team
        let flagOwningTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
        if(flagOwningTeamVO && vo_flag){
            mod.PlayVO(flagOwningTeamVO, mod.VoiceOverEvents2D.ObjectiveNeutralised, vo_flag, this.team);
        }
        
        // Play VO for all opposing teams
        const opposingTeams = GetOpposingTeams(this.owningTeamId);
        for (const opposingTeamId of opposingTeams) {
            const opposingTeam = teams.get(opposingTeamId);
            if (opposingTeam) {
                let capturingTeamVO: mod.VO = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_VOModule_OneShot2D, this.currentPosition, ZERO_VEC);
                if(capturingTeamVO && vo_flag){
                    mod.PlayVO(capturingTeamVO, mod.VoiceOverEvents2D.ObjectiveNeutralised, vo_flag, opposingTeam);
                }
            }
        }
    }
}

function HandleFlagInteraction(
    player: mod.Player, 
    playerTeamId: number, 
    flag: Flag
): void {
    
    if (DEBUG_MODE) {
        // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.red_flag_position, mod.XComponentOf(flagData.homePosition), mod.YComponentOf(flagData.homePosition), mod.ZComponentOf(flagData.homePosition)));
    }

    // Enemy team trying to take flag
    if (playerTeamId !== flag.teamId) {
        if (flag.isAtHome || (flag.isDropped && flag.canBePickedUp)) {
            flag.PickupFlag(player);
        } else if (flag.isDropped && !flag.canBePickedUp) {
            if(DEBUG_MODE){
                mod.DisplayHighlightedWorldLogMessage(
                    mod.Message(mod.stringkeys.waiting_to_take_flag),
                    player
                );
            }
        }
    }
    // Own team trying to return dropped flag
    else if (playerTeamId === flag.teamId){
        if(flag.isDropped){
            if(DEBUG_MODE)
                mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.team_flag_returned, GetTeamName(flag.team)));
            flag.PlayFlagReturnedSFX();
            flag.ReturnFlag(player);
        } else if(flag.isAtHome) {
            mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.flag_friendly_at_home), player);
        }
    }
}


function GetFlagTeamIdOffset(team: mod.Team): number {
    let teamID = mod.GetObjId(team);
    return TEAM_ID_START_OFFSET + (teamID * TEAM_ID_STRIDE_OFFSET);
}

function GetDefaultFlagSpawnIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_SPAWN_ID_OFFSET;
}

function DropAllFlags(player: mod.Player){
    let playerPos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
    let playerPosX = mod.XComponentOf(playerPos);
    let playerPosY = mod.YComponentOf(playerPos);
    let playerPosZ = mod.ZComponentOf(playerPos);
    let flagDropRadius = FLAG_DROP_RING_RADIUS;

    let carriedFlags = GetCarriedFlags(player);
    let angleInc = Math.PI * 2.0 / carriedFlags.length;

    let numFlags = carriedFlags;

    //Create a ring of coordinates
    for(let i = 0; i < carriedFlags.length; ++i){
        let angle = i * angleInc;
        let x = flagDropRadius * Math.cos(angle);
        let z = flagDropRadius * Math.sin(angle);
        carriedFlags[i].DropFlag(mod.Add(playerPos, mod.CreateVector(x, 0.0, z)));
    }
}

function GetCarriedFlags(player: mod.Player): Flag[] {
    return Array.from(flags.values()).filter((flag: Flag) => {
        if(!flag.carrierPlayer || !flag.isBeingCarried) return false;
        return mod.Equals(flag.carrierPlayer, player);
    }
    );
}

function IsCarryingAnyFlag(player: mod.Player): boolean {
    // Check all flags dynamically
    for (const [flagId, flagData] of flags.entries()) {
        if (flagData.carrierPlayer && mod.Equals(flagData.carrierPlayer, player)) {
            return true;
        }
    }
    return false;
}

// Was the player previously holding a flag?
function WasCarryingAnyFlag(player: mod.Player): boolean {
    // Check all flags dynamically
    for (const [flagId, flagData] of flags.entries()) {
        if (flagData.carrierPlayer && mod.Equals(flagData.lastCarrier, player)) {
            return true;
        }
    }
    return false;
}

function GetOpposingTeamsForFlag(flagData: Flag): number[] {
    // If flag has specific allowed capturing teams, return those
    if (flagData.allowedCapturingTeams.length > 0) {
        return flagData.allowedCapturingTeams;
    }
    
    // Otherwise return all teams except the flag owner
    return GetOpposingTeams(flagData.owningTeamId);
}
