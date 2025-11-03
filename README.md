# CTF-BF6

This repository contains a Capture The Flag Custom Portal Game Mode for Battlefield 6 that you can use to either create your own flag based game modes or your own CTF maps.

## Requirements
- [Battlefield 6 Portal SDK](https://download.portal.battlefield.com/PortalSDK.zip). Read the instructions [here](https://www.ea.com/en/games/battlefield/battlefield-6/news/portal-101-advanced-creations) to get it up and running.

## Installation
- Download this repository as a zip file from [this link](https://github.com/Mystfit/BF6-CTF-Portal/archive/refs/heads/main.zip).
- The folders and files inside the `GodotProject` folder should mirror the structure of the Godot project provided withen the Portal SDK. Copy the files across to your Portal SDK project folder in the same locations.

## Setting up your map in Godot
- Two sample maps, `MP_FireStorm_CTF.tscn` and `MP_Granite_ClubHouse_CTF_4team.tscn` are provided as examples for how to set up your own map.
- If you're setting up your own map you will need to drag a few nodes from the `res://objects/Gameplay/CTF` filesystem folder into your map to setup it up. 
- At a minimum you will need a flag spawner (`res://objects/Gameplay/CTF/FlagCaptureZone.tscn`) and capture zone (`res://objects/Gameplay/CTF/FlagSpawner.tscn`) for each team, as well as a single Game Mode Config node (`res://objects/Gameplay/CTF/GameModeConfig.tscn`). 
- Nodes can be dragged into the scene from the filesystem panel. Flag spawners and capture zones don't have to be placed right on top of each other. For example, you could put a flag spawner in the middle of the map, and a capture zone for one team at the opposite team's spawn location to create a bomb delivery game mode.
- For each flag spawner and capture zone, select it and in the inspector set the `Team` property to to the team that should own the flag spawned at the spawner, and the capture zone that a team has to deliver a flag to in order to score. All of the `ObjId` properties for child objects will automatically update.
- For the game mode config node, choose which rule set you would like to use for the map using the `Config` parameter in the inspector.
- Before exporting, right-click each flag spawner, capture zone, and the gamemode config node in the scene panel and for each click `Make Local`. This allows us to export child nodes within each scene node.
- Export your level using the `BFPortal->Export Current Level` button to create a `MAP_NAME.spatial.json` file that will be added to your portal experience.

## Setting up your Portal Experience
- Duplicate the [master CTF Portal experience](https://portal.battlefield.com/bf6/en-gb/experience/settings/mode?id=f679d910-b3d2-11f0-9f56-5d2868ecfc8a&teams=0)  (the code may be older than this repository) or [the 4-team version](https://portal.battlefield.com/bf6/en-gb/experience/settings/mode?id=9d3e65f0-acac-11f0-8ad6-9ffd2a4b12a2&teams=0)
- If you'd prefer to create a new experience from scratch:
    - Make sure that the map that you already created a spatial.json file for is added to your map rotation. Click the `Attach a spatial JSON for this map` button to upload your custom CTF spatial.json file for your map.
    - In `Rules Editor->Script`, click the `Manage scripts` button and upload `CTF.ts` and `CTF.strings.json`, both available at the root of zip file you downloaded.
- Save the experience and test inside BF6.
- Publish your awesome CTF map experience so others can play!

## Community Maps
Coming soon

## TODO
- WorldIcon and SmokeVFX don't show up for other players sometimes. Track down desync issue
- Make sure team and player UIs are properly scoped
