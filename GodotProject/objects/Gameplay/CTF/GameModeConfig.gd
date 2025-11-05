@tool
class_name Game_Mode_Config
extends Node3D

enum Configs {TwoTeam, FourTeam}
@export var Config: Configs = Configs.TwoTeam:
	get:
		return Config
	set(value):
		Config = value
		UpdateIds()

@export var id = ""

var global_name = self.get_script().get_global_name()

func UpdateIds():
	var dummyspatial = self.get_child(0) as AmmoChest_Small_01
	dummyspatial.ObjId = 40000 + int(Config)

func _validate_property(property: Dictionary):
	if property.name == "id":
		property.usage = PROPERTY_USAGE_NO_EDITOR
		
func _ready():
	if Engine.is_editor_hint():
		UpdateIds()
