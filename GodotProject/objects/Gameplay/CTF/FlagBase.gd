@tool
class_name Flag_Base
extends Node3D

enum Team_selection {TeamNeutral, Team1, Team2, Team3, Team4, Team5, Team6, Team7, Team8, Team9, Team10, Team11, Team12, Team13, Team14, Team15, Team16, Team17, Team18, Team19, Team20, Team21, Team22, Team23, Team24, Team25, Team26, Team27, Team28, Team29, Team30, Team31, Team32, Team33, Team34, Team35, Team36, Team37, Team38, Team39, Team40, Team41, Team42, Team43, Team44, Team45, Team46, Team47, Team48, Team49, Team50, Team51, Team52, Team53, Team54, Team55, Team56, Team57, Team58, Team59, Team60, Team61, Team62, Team63, Team64, Team65, Team66, Team67, Team68, Team69, Team70, Team71, Team72, Team73, Team74, Team75, Team76, Team77, Team78, Team79, Team80, Team81, Team82, Team83, Team84, Team85, Team86, Team87, Team88, Team89, Team90, Team91, Team92, Team93, Team94, Team95, Team96, Team97, Team98, Team99, Team100, Team101, Team102, Team103, Team104, Team105, Team106, Team107, Team108, Team109, Team110, Team111, Team112, Team113, Team114, Team115, Team116, Team117, Team118, Team119, Team120, Team121, Team122, Team123, Team124, Team125, Team126, Team127, Team128, TeamIdCount}
@export var Team: Team_selection = Team_selection.Team1:
	get:
		return Team
	set(value):
		Team = value
		UpdateIds()

@export var ObjId = 0
@export var id = ""

var global_name = self.get_script().get_global_name()

func UpdateIds():
	ObjId = 100 + (int(Team) * 10)
	var flag_interact = self.get_child(0) as InteractPoint
	var flag_area_trigger = flag_interact.get_child(0) as AreaTrigger
	var flag_icon = flag_interact.get_child(1) as WorldIcon
	var flag_spawn_prop = flag_interact.get_child(2) as Node3D
	flag_interact.ObjId = ObjId + 1
	flag_area_trigger.ObjId = ObjId + 2
	flag_icon.ObjId = ObjId + 3
	flag_spawn_prop.ObjId = ObjId + 4
	print("Setting flag obj id to ", ObjId)

func _validate_property(property: Dictionary):
	if property.name == "id":
		property.usage = PROPERTY_USAGE_NO_EDITOR
		
func _ready():
	if Engine.is_editor_hint():
		UpdateIds()
		
		var flag_interact = get_child(0) as InteractPoint
		var flag_area_trigger = flag_interact.get_child(0) as AreaTrigger
		if !flag_area_trigger.Area:
			flag_area_trigger.Area = flag_area_trigger.get_child(0) as PolygonVolume
