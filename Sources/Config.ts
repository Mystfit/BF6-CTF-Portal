/* 
 * Capture the Flag Game Mode
 * 
 * Two (or more) teams compete to capture the enemy flag and return it to their base.
 * First team to reach the target score wins.
 * Author: Mystfit and Claude Sonnet 4.5 (20250929).
 */

//==============================================================================================
// HOW IT WORKS - Understanding CTF Game Flow
//==============================================================================================
/*
 * CLASSIC CTF FLAG LIFECYCLE EXPLAINED (ClassicCTFConfig game mode)
 * =========================
 * 1. AT HOME (isAtHome=true)
 *    - Flag sits at the flag spawn point with an interaction point
 *    - Opposing teams can pick up the flag by interacting with it
 *
 * 2. BEING CARRIED (isBeingCarried=true)
 *    - An player on an opposing team can pick up the flag by interacting with it to become a flag carrier  - Carrier forced to melee weapon (can't shoot)
 *    - Flag carriers can't drive vehicles (forced to passenger seat)
 *    - Flag carriers are globally visible by an icon above their head as well as a smoke trail and are forcefully spotted
 *
 * 3. DROPPED (isDropped=true)
 *    - The flag is dropped when the carrier dies or when manually dropped by the carrier switching weapons
 *    - Configurable (5 second default) delay before anyone can pick the flag up again
 *    - The flag will auto-return to base after after a configurable delay (30 second default) if not picked up
 *    - The flag's owning team can return the flag early by interacting with it
 *
 * 4. SCORING
 *    - The flag carrier enters their teams capture zone with enemy flag
 *    - The flag carrier's team flag must be at home to score
 *    - Team gets 1 point, first to TARGET_SCORE wins
 *
 * MULTI-TEAM SUPPORT (FourTeamCTFConfig game mode):
 * ===================
 * - Default is 4 teams but compatible with 3-7 teams. 
 * - Each flag can restrict which teams can capture it
 */

//==============================================================================================
// CONFIGURATION CONSTANTS
// This file contains all configuration constants that need to be loaded before other modules
//==============================================================================================

const VERSION = [2, 4, 0];

const DEBUG_MODE = false;                                            // Print extra debug messages

// Game Settings
const GAMEMODE_TARGET_SCORE = 10;                                    // Points needed to win

// Flag settings
const FLAG_PICKUP_DELAY = 5;                                        // Seconds before dropped flag can be picked up and when carrier kills are still counted
const FLAG_AUTO_RETURN_TIME = 30;                                   // Seconds before dropped flag auto-returns to base

// Flag carrier settings
const CARRIER_FORCED_WEAPON = mod.Gadgets.Melee_Sledgehammer;       // Weapon to automatically give to a flag carrier when a flag is picked up
const CARRIER_FORCED_WEAPON_SLOT = mod.InventorySlots.MeleeWeapon;  // Force flag carrier to swap to this slot on flag pickup, swapping will drop flag
const CARRIER_CAN_HOLD_MULTIPLE_FLAGS = false;                       // Let the flag carrier pick up multiple flags at once

// Team balance
const TEAM_AUTO_BALANCE: boolean = true;                            // Make sure teams are evenly balanced 
const TEAM_BALANCE_DELAY = 5.0;                                     // Seconds to delay before auto-balancing teams
const TEAM_BALANCE_CHECK_INTERVAL = 10;                             // Check balance every N seconds

// Vehicles
const VEHICLE_BLOCK_CARRIER_DRIVING: boolean = true;


//==============================================================================================
// ADDITIONAL CONSTANTS - Fine-tuning values
//==============================================================================================

// Flag placement and positioning
const FLAG_SFX_DURATION = 5.0;                                      // Time delay before alarm sound shuts off
const FLAG_ICON_HEIGHT_OFFSET = 2.5;                                // Height that the flag icon should be placed above a flag
const FLAG_INTERACTION_HEIGHT_OFFSET = 1.3;                         // Height offset for flag interaction point
const FLAG_SPAWN_HEIGHT_OFFSET = 0.5;                               // Height offset when spawning flag above ground
const FLAG_COLLISION_RADIUS = 1.5;                                  // Safety radius to prevent spawning inside objects
const FLAG_COLLISION_RADIUS_OFFSET = 1;                             // Offset the start of the radius to avoid ray collisions inside the flag
const FLAG_DROP_DISTANCE = 2.5;                                     // Distance in front of player when dropping flag
const FLAG_DROP_RAYCAST_DISTANCE = 100;                             // Maximum distance for downward raycast when dropping
const FLAG_DROP_RING_RADIUS = 2.5;                                  // Radius for multiple flags dropped in a ring pattern
const FLAG_ENABLE_ARC_THROW = true;                                 // True = Enable flag throwing, False = simple wall + ground detection for dropped flag
const FLAG_THROW_SPEED = 5;                                         // Speed in units p/s to throw a flag away from a player
const FLAG_FOLLOW_DISTANCE = 3;                                     // Distance flag will follow the player at
const FLAG_FOLLOW_POSITION_SMOOTHING = 0.5;                         // Exponential smoothing factor for position (0-1, lower = smoother)
const FLAG_FOLLOW_ROTATION_SMOOTHING = 0.5;                         // Exponential smoothing factor for rotation (0-1, lower = smoother)
const FLAG_FOLLOW_SAMPLES = 20;
const FLAG_TERRAIN_RAYCAST_SUPPORT = false;                         // TODO: Temp hack until terrain raycasts fixed. Do we support raycasts against terrain?
const FLAG_PROP = mod.RuntimeSpawn_Common.MCOM;                     // Prop representing a flag at a spawner and when dropped
const FLAG_FOLLOW_MODE = false;                                     // Flag follows the player.
const FLAG_TERRAIN_FIX_PROTECTION = false;                          // FIXES TERRAIN RAYCAST BUG: Flag will not drop under the player's Y position when thrown
const SOLDIER_HALF_HEIGHT = 0.75;                                   // Midpoint of a soldier used for raycasts
const SOLDIER_HEIGHT = 2;                                           // Full soldier height

// Spawn validation settings
const SPAWN_VALIDATION_DIRECTIONS = 4;                              // Number of radial check directions
const SPAWN_VALIDATION_MAX_ITERATIONS = 1;                          // Maximum adjustment passes
const SPAWN_VALIDATION_HEIGHT_OFFSET = 0.75;                        // Height offset above adjusted position for ground detection ray

// Vehicle seat indices
const VEHICLE_DRIVER_SEAT = 0;                                      // Driver seat index in vehicles
const VEHICLE_FIRST_PASSENGER_SEAT = 1;                             // First passenger seat index

// Update rates
const TICK_RATE = 0.032;                                            // ~30fps update rate for carrier position updates (portal server tickrate)
