# CTF-BF6

This repository contains a Capture The Flag Custom Portal Game Mode for Battlefield 6 that you can use to either create your own flag based game modes or your own CTF maps.

## Requirements
- [Battlefield 6 Portal SDK](https://download.portal.battlefield.com/PortalSDK.zip). Read the instructions [here](https://www.ea.com/en/games/battlefield/battlefield-6/news/portal-101-advanced-creations) to get it up and running.

## Installation
- Download this repository as a zip file from [this link](https://github.com/Mystfit/BF6-CTF-Portal/archive/refs/heads/main.zip).
- The folders and files inside the `GodotProject` folder should mirror the structure of the Godot project provided withen the Portal SDK. Copy the files across to your Portal SDK project folder in the same locations.

## Setting up your map in Godot
- Two sample maps, `MP_FireStorm_CTF.tscn` and `MP_FireStorm_CTF_tiny.tscn` are provided as examples for how to set up your own map.
- If you're setting up your own map, then drag two FlagBase scene nodes from `res://objects/Gameplay/CTF/FlagBase.tscn` into your open map scene, one for each team. Place them where you want each teams flag to spawn.
- For each flag base, select it and in the inspector set the `Team` property to `Team 1` for the first flag base and `Team 2` for the second. All of the `ObjId` properties will automatically update.
- Right-click each `FlagBase` node in the scene panel and click `Make Local`. This is to allow us to export the child nodes within each FlagBase scene node.
- Export your level using the `BFPortal->Export Current Level` button to create a `MAP_NAME.spatial.json` file that will be added to your portal experience.

## Setting up your Portal Experience
- Duplicate the [master CTF Portal experience](https://portal.battlefield.com/bf6/en-gb/experience/settings/mode?id=a091f380-a666-11f0-a8ef-d7e10093ca02&teams=0)  (the code may be older than this repository)  
- If you'd prefer to create a new experience from scratch:
    - Make sure that the map that you already created a spatial.json file for is added to your map rotation. Click the `Attach a spatial JSON for this map` button to upload your custom CTF spatial.json file for your map.
    - In `Rules Editor->Script`, click the `Manage scripts` button and upload `CTF.ts` and `CTF.strings.json`, both available at the root of zip file you downloaded.
- Save the experience and test inside BF6.
- Publish your awesome CTF map experience so others can play!

## Community Maps
Coming soon

## TODO
- Disable alarm sound after 3 loops
- Add markers for each base. Your base marker is ALWAYS visible. Enemy team base marker disappears when their flag is away.
- Fix recover marker colour
- Consistent icon & smoke colour
- Change team colours to purple and orange
- Flag dropping inside props
- Drop icon update rate
- Force 3D spot flag carrier
- Option for flag carrier to have pistol
- Custom UI for flag info