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

                // Create world icons for our team         
                this.baseIcons = new Map();
                let teamIcon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, this.iconPosition, ZERO_VEC) as mod.WorldIcon;
                mod.SetWorldIconOwner(teamIcon, team);
                this.baseIcons.set(mod.GetObjId(team), teamIcon);
                
                // Create world icons for opposing teams        
                let opposingTeams = GetOpposingTeams(mod.GetObjId(team));
                if(opposingTeams.length && team){
                    for(let opposingTeam of opposingTeams){
                        let opposingIcon = mod.SpawnObject(mod.RuntimeSpawn_Common.WorldIcon, this.iconPosition, ZERO_VEC) as mod.WorldIcon;
                        mod.SetWorldIconOwner(opposingIcon, mod.GetTeam(opposingTeam));
                        this.baseIcons.set(opposingTeam, opposingIcon);
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
        if(this.baseIcons){
            for(let [targetTeamId, icon] of this.baseIcons.entries()){
                if(targetTeamId == this.teamId){
                    // Icon is for capture zone owner
                } else {
                    // Icon is for opposing team
                }
                mod.SetWorldIconText(icon, mod.Message(mod.stringkeys.capture_zone_label, GetTeamName(this.team)));
                mod.SetWorldIconImage(icon, mod.WorldIconImages.Triangle);
                mod.SetWorldIconColor(icon, GetTeamColorById(this.teamId));
                mod.SetWorldIconPosition(icon, this.iconPosition);
                mod.EnableWorldIconText(icon, true);
                mod.EnableWorldIconImage(icon, true);
            }
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
                mod.DisplayHighlightedWorldLogMessage(
                    mod.Message(mod.stringkeys.waiting_for_flag_return),
                    player
                );
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