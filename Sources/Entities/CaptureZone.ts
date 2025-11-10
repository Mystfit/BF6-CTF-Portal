//==============================================================================================
// CAPTURE ZONE CLASS
//==============================================================================================

class CaptureZone {
    readonly team: mod.Team;
    readonly teamId: number;
    readonly areaTrigger: mod.AreaTrigger | undefined;
    readonly captureZoneID?: number;
    readonly captureZoneSpatialObjId?: number;
    readonly position: mod.Vector;
    readonly iconPosition: mod.Vector;
    readonly baseIcons?: Map<number, mod.WorldIcon>;// One icon per opposing team

    // WorldIcon manager IDs for tracking
    private baseIconIds: Map<number, string> = new Map();

    constructor(team: mod.Team, captureZoneID?: number, captureZoneSpatialObjId?:number){
        this.team = team;
        this.teamId = mod.GetObjId(team);
        this.captureZoneID = captureZoneID ? captureZoneID : GetDefaultFlagCaptureZoneAreaTriggerIdForTeam(team);
        this.captureZoneSpatialObjId = captureZoneSpatialObjId ? captureZoneSpatialObjId : GetDefaultFlagCaptureZoneSpatialIdForTeam(this.team);
        this.iconPosition = ZERO_VEC;
        this.position = ZERO_VEC;

        this.areaTrigger = this.captureZoneID ? mod.GetAreaTrigger(this.captureZoneID) : undefined;
        if(!this.areaTrigger)
            console.log(`Could not find team ${this.teamId} area trigger for capture zone ID ${this.captureZoneID}`);

        if(this.captureZoneSpatialObjId){
            let captureZoneSpatialObj = mod.GetSpatialObject(this.captureZoneSpatialObjId);
            if(captureZoneSpatialObj)
            {
                this.position = mod.GetObjectPosition(captureZoneSpatialObj);

                // Get our world icon position for this capture zone
                this.iconPosition = mod.Add(this.position, mod.CreateVector(0.0, FLAG_ICON_HEIGHT_OFFSET, 0.0));

                // Register WorldIcons with WorldIconManager
                const iconMgr = worldIconManager;
                this.baseIcons = new Map();

                // Create world icon for our team
                const teamIconId = `capturezone_${this.teamId}_team${this.teamId}`;
                let teamIcon = iconMgr.createIcon(
                    teamIconId,
                    this.iconPosition,
                    {
                        icon: mod.WorldIconImages.Triangle,
                        iconEnabled: true,
                        textEnabled: true,
                        text: mod.Message(mod.stringkeys.capture_zone_label, GetTeamName(this.team)),
                        color: GetTeamColorById(this.teamId),
                        teamOwner: team
                    }
                );
                this.baseIcons.set(mod.GetObjId(team), teamIcon);
                this.baseIconIds.set(mod.GetObjId(team), teamIconId);

                // Create world icons for opposing teams
                let opposingTeams = GetOpposingTeams(mod.GetObjId(team));
                if(opposingTeams.length && team){
                    for(let opposingTeam of opposingTeams){
                        const opposingIconId = `capturezone_${this.teamId}_team${opposingTeam}`;
                        let opposingIcon = iconMgr.createIcon(
                            opposingIconId,
                            this.iconPosition,
                            {
                                icon: mod.WorldIconImages.Triangle,
                                iconEnabled: true,
                                textEnabled: true,
                                color: GetTeamColorById(this.teamId),
                                teamOwner: mod.GetTeam(opposingTeam)
                            }
                        );
                        this.baseIcons.set(opposingTeam, opposingIcon);
                        this.baseIconIds.set(opposingTeam, opposingIconId);
                    }
                }

                this.UpdateIcons();
            } else {
                console.log(`Can't create WorldIcon for ${this.teamId} capture zone. Spatial object ${captureZoneSpatialObj} returned for id ${this.captureZoneSpatialObjId}}`);
            }
        } else {
            console.log(`Can't create WorldIcon for ${this.teamId} capture zone. Spatial object ID was ${this.captureZoneSpatialObjId}`);
        }
    }

    UpdateIcons(){
        // Use WorldIconManager methods instead of direct mod calls
        // This ensures we're updating the current icon even after refresh
        const iconMgr = worldIconManager;

        for(let [targetTeamId, iconId] of this.baseIconIds.entries()){
            if(targetTeamId == this.teamId){
                // Icon is for capture zone owner
            } else {
                // Icon is for opposing team
            }
            iconMgr.setText(iconId, mod.Message(mod.stringkeys.capture_zone_label, GetTeamName(this.team)));
            iconMgr.setIcon(iconId, mod.WorldIconImages.Triangle);
            iconMgr.setColor(iconId, GetTeamColorById(this.teamId));
            iconMgr.setPosition(iconId, this.iconPosition);
            iconMgr.setEnabled(iconId, true, true); // icon enabled, text enabled
        }
    } 

    HandleCaptureZoneEntry(player: mod.Player): void 
    {
        let jsPlayer = JSPlayer.get(player);
        let playerTeamId = mod.GetObjId(mod.GetTeam(player));

        GetCarriedFlags(player).forEach((flag:Flag) => {
            // Check if player is carrying an enemy flag
            if (!flag) {
                if (DEBUG_MODE) {
                    console.log(`Could not find a held flag for the provided player ${mod.GetObjId(player)}`);
                }
                return;
            }
            
            // Verify the flag is owned by an opposing team
            if (flag.owningTeamId === playerTeamId) {
                if (DEBUG_MODE) {
                    console.log(`Player ${mod.GetObjId(player)} entered their teams capture zone but doesn't have the enemy flag`);
                    // mod.DisplayHighlightedWorldLogMessage(mod.Message(mod.stringkeys.not_carrying_flag, player));
                }
                return;
            }
            
            // Verify player entered the capture zone for their own team
            if (this.teamId !== playerTeamId) {
                if (DEBUG_MODE) {
                    console.log(`Players team ${playerTeamId} but entered wrong capture zone ${this.teamId}`);
                }
                return;
            }
            
            // Check if own flag is at home (get player's team flag)
            const ownFlag = flags.get(playerTeamId);
            if (ownFlag && !ownFlag.isAtHome) {
                if(DEBUG_MODE){
                    mod.DisplayHighlightedWorldLogMessage(
                        mod.Message(mod.stringkeys.waiting_for_flag_return),
                        player
                    );
                }
                return;
            }
        
            // Team Score!
            ScoreCapture(player, flag, this.team);
        });

        
    }
}

function GetDefaultFlagCaptureZoneAreaTriggerIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_CAPTURE_ZONE_ID_OFFSET;
}

function GetDefaultFlagCaptureZoneSpatialIdForTeam(team: mod.Team): number {
    return GetFlagTeamIdOffset(team) + FlagIdOffsets.FLAG_CAPTURE_ZONE_ICON_ID_OFFSET;
}