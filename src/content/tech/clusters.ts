import type { ClusterSpec } from './specs';

// Small-node fans around each major. Angles: 0 = right (+x), 90 = down (+y),
// -90 = up, 180 = left. Fans point AWAY from the anchor's path edges — the
// validate script warns on node pairs closer than ~100px, so check it after
// moving anything. Names become node ids; keep them unique tree-wide.
export const CLUSTERS: ClusterSpec[] = [
  // ---- Inner core -------------------------------------------------------------
  { anchor: 'blueprints', branch: 'tech', eff: 'craft', cost: { plank: 5, stone: 3 }, time: 90, angle: 90, spread: 80, names: ['Draft Tables', 'Ink Lines', 'Careful Copies'] },
  { anchor: 'spirit_pistons', branch: 'magitech', eff: 'both', cost: { stone: 8, wood: 8 }, time: 90, angle: 0, spread: 80, radius: 190, names: ['Piston Chants', 'Spirit Valves', 'Breath Timing'] },
  { anchor: 'spirit_pistons', branch: 'magitech', eff: 'both', cost: { stone: 8, water: 8 }, time: 90, angle: 180, spread: 80, radius: 190, names: ['Vapor Spirits', 'Whistle Songs', 'Warm Bearings'] },
  { anchor: 'arcane_engine', branch: 'magitech', eff: 'both', cost: { plank: 6, rope: 2 }, time: 150, angle: 0, spread: 80, radius: 190, names: ['Mana Injectors', 'Rune Timing', 'Soft Idle'] },
  { anchor: 'arcane_engine', branch: 'magitech', eff: 'both', cost: { plank: 6, water: 8 }, time: 150, angle: 180, spread: 80, radius: 190, names: ['Ley Bearings', 'Singing Gears', 'Warm Mana'] },

  // ---- Tech branch (right) ----------------------------------------------------
  { anchor: 'ironworking', branch: 'tech', eff: 'craft', cost: { iron_ingot: 2 }, time: 120, angle: -115, spread: 80, depth: 2, radius: 190, names: ['Bellows Crews', 'Forge Hymns', 'Quench Oil', 'Tempering', 'Anvil Rhythm', 'Spark Watching'] },
  { anchor: 'toolmaking', branch: 'tech', eff: 'craft', cost: { iron_ingot: 2, plank: 4 }, time: 120, angle: 90, spread: 90, depth: 2, names: ['Handle Fitting', 'Edge Honing', 'Tool Racks', 'Grip Wraps', 'File Work', 'Burr Removal'] },
  { anchor: 'claywork', branch: 'tech', eff: 'gather:clay', cost: { clay: 6 }, time: 150, angle: -90, spread: 80, depth: 2, radius: 220, names: ['Clay Sense', 'Slip Casting', 'Coil Building', 'Kiln Stacking', 'Ash Sifting', 'Glaze Dips', 'Slip Trailing', 'Sgraffito'] },
  { anchor: 'steelworks', branch: 'tech', eff: 'craft', cost: { steel: 2 }, time: 180, angle: -90, spread: 70, names: ['Alloy Ratios', 'Rolling Mills', 'Hardness Tests'] },
  { anchor: 'carpentry', branch: 'tech', eff: 'craft', cost: { plank: 10 }, time: 150, angle: 90, spread: 70, depth: 2, names: ['Grain Reading', 'Steam Bending', 'Lacquer Coats', 'Clamp Sets', 'Miter Joints', 'Sanding Drums'] },
  { anchor: 'glassworks', branch: 'tech', eff: 'craft', cost: { glass: 3 }, time: 180, angle: -90, spread: 80, depth: 2, radius: 220, names: ['Batch Recipes', 'Annealing', 'Glory Holes', 'Blowpipes', 'Cullet Reuse', 'Polish Rouge', 'Frit Mixing', 'Silver Stain'] },
  { anchor: 'construction', branch: 'tech', eff: 'craft', cost: { stone_brick: 10 }, time: 180, angle: 90, spread: 80, names: ['Rebar Ties', 'Arch Falsework', 'Level Sights'] },
  { anchor: 'mechanisms', branch: 'tech', eff: 'craft', cost: { gear: 4 }, time: 180, angle: 112, spread: 100, depth: 2, radius: 185, names: ['Ratchets', 'Pawl Springs', 'Chain Drives', 'Idler Wheels', 'Grease Cups', 'Timing Marks', 'Worm Screws', 'Roller Chains'] },
  { anchor: 'chemistry', branch: 'tech', eff: 'craft', cost: { sulfur: 4, glass: 2 }, time: 210, angle: -90, spread: 120, depth: 2, names: ['Litmus Papers', 'Salt Baths', 'Fume Hoods', 'Catalyst Dust', 'Careful Labels', 'Wash Bottles', 'Acid Etching', 'Soap Works'] },
  { anchor: 'plumbing', branch: 'tech', eff: 'craft', cost: { pipe: 3, copper_ingot: 4 }, time: 210, angle: -90, spread: 70, names: ['Traps & Bends', 'Solder Joints', 'Flow Meters'] },
  { anchor: 'fine_machinery', branch: 'tech', eff: 'craft', cost: { gearbox: 1 }, time: 240, angle: 100, spread: 70, depth: 2, names: ['Hairsprings', 'Gear Trains', 'Polished Arbors', 'Loupe Work', 'Tiny Screws', 'Dust Covers'] },
  { anchor: 'everyday_engineering', branch: 'tech', eff: 'craft', cost: { spring: 2, paper: 4 }, time: 240, angle: 90, spread: 120, depth: 2, names: ['Fit & Finish', 'Spare Parts', 'User Manuals', 'Showrooms', 'Warranty Seals', 'Paint Lines', 'Nickel Plating', 'Rubber Grips'] },
  { anchor: 'transport', branch: 'tech', eff: 'craft', cost: { wheel: 2, rope: 6 }, time: 240, angle: 30, spread: 80, depth: 2, names: ['Cargo Manifests', 'Tow Ropes', 'Route Maps', 'Wheel Chocks', 'Way Stations', 'Harbor Cranes'] },
  { anchor: 'steam_power', branch: 'tech', eff: 'craft', cost: { coal: 12, iron_plate: 2 }, time: 270, angle: -110, spread: 70, depth: 2, names: ['Boiler Lagging', 'Steam Whistles', 'Governor Balls', 'Firebox Grates', 'Water Gauges', 'Coal Chutes'] },
  { anchor: 'railworks', branch: 'tech', eff: 'craft', cost: { steel: 4, wooden_beam: 2 }, time: 270, angle: 85, spread: 120, depth: 2, names: ['Ballast Beds', 'Sleeper Ties', 'Signal Lamps', 'Water Stops', 'Timetables', 'Coupling Hooks', 'Rail Spikes', 'Tunnel Bracing'] },
  { anchor: 'oil_age', branch: 'tech', eff: 'craft', cost: { crude_oil: 4 }, time: 300, angle: -90, spread: 120, depth: 2, names: ['Mud Logging', 'Gusher Caps', 'Storage Tanks', 'Fraction Cuts', 'Wax Skimming', 'Flare Stacks', 'Pump Jacks', 'Sump Pits'] },
  { anchor: 'electricity', branch: 'tech', eff: 'craft', cost: { copper_wire: 10, voltite: 2 }, time: 300, angle: 100, spread: 70, depth: 2, names: ['Fuse Boxes', 'Ground Rods', 'Bus Bars', 'Coil Winding', 'Ohm Tables', 'Spark Gaps'] },
  { anchor: 'automation', branch: 'tech', eff: 'craft', cost: { circuit: 2 }, time: 360, angle: 45, spread: 100, depth: 2, names: ['Jig Feeders', 'Belt Timing', 'Cam Programs', 'Fault Bells', 'Oil Drips', 'Spare Automata', 'Sorting Arms', 'Idle Watchers'] },
  { anchor: 'communications', branch: 'tech', eff: 'craft', cost: { copper_wire: 14 }, time: 360, angle: -45, spread: 100, depth: 2, names: ['Antenna Masts', 'Code Books', 'Relay Towers', 'Night Signals', 'Press Wires', 'Weather Flags', 'Carrier Pigeons', 'Morse Drills'] },

  // ---- Magic branch (left) ------------------------------------------------------
  { anchor: 'sapcraft', branch: 'magic', eff: 'gather:resin', cost: { resin: 4 }, time: 120, angle: -80, spread: 70, depth: 2, names: ['Sticky Fingers', 'Bark Grafts', 'Sweet Sap', 'Gum Harvest', 'Sun Curing', 'Patient Taps'] },
  { anchor: 'sapcraft', branch: 'magic', eff: 'gather:wood', cost: { wood: 12 }, time: 120, angle: 165, spread: 70, names: ['Grove Keeping', 'Bark Whispers', 'Slow Drips'] },
  { anchor: 'herbalism', branch: 'magic', eff: 'gather:herbs', cost: { herbs: 5 }, time: 120, angle: 75, spread: 70, names: ['Petal Lore', 'Drying Racks', 'Wild Gathering'] },
  { anchor: 'weaving', branch: 'magic', eff: 'gather:fiber', cost: { fiber: 10 }, time: 150, angle: 90, spread: 100, depth: 2, names: ['Tension Songs', 'Shuttle Skill', 'Pattern Cards', 'Fine Threads', 'Hem Stitches', 'Loom Blessings', 'Twill Patterns', 'Selvage Edges'] },
  { anchor: 'alchemy', branch: 'magic', eff: 'gather:all', cost: { herbal_extract: 2, salt: 2 }, time: 180, angle: -64, spread: 76, depth: 2, names: ['Slow Simmer', 'Clear Filtrates', 'Bitter Salts', 'Glass Stirring', 'Patient Notes', 'Triple Wash'] },
  { anchor: 'ambercraft', branch: 'magic', eff: 'gather:amber', cost: { amber: 4 }, time: 180, angle: 45, spread: 70, depth: 2, names: ['Warm Polish', 'Inclusion Reading', 'Honey Light', 'Pearl Rolling', 'Gentle Heat', 'Resin Layers'] },
  { anchor: 'sporecraft', branch: 'magic', eff: 'gather:glowspore', cost: { glowspore: 4 }, time: 210, angle: -65, spread: 80, depth: 2, names: ['Dark Gardens', 'Spore Songs', 'Glow Tending', 'Damp Cloths', 'Cave Etiquette', 'Soft Light'] },
  { anchor: 'scrivenery', branch: 'magic', eff: 'gather:all', cost: { paper: 6, enchanted_ink: 1 }, time: 210, angle: 120, spread: 40, depth: 2, names: ['Steady Hands', 'Vellum Prep', 'Letter Forms', 'Ink Wells'] },
  { anchor: 'lunar_rites', branch: 'magic', eff: 'gather:moon_dew', cost: { moon_dew: 3 }, time: 240, angle: 90, spread: 80, depth: 2, names: ['Moon Baths', 'Silver Basins', 'Night Silence', 'Dew Combs', 'Phase Keeping', 'Veiled Lamps'] },
  { anchor: 'vitalism', branch: 'magic', eff: 'gather:all', cost: { herbal_extract: 4, glowspore: 4 }, time: 270, angle: -90, spread: 120, depth: 2, names: ['Warm Broths', 'Pulse Reading', 'Breath of Life', 'Gentle Stitches', 'Green Blood', 'Cradle Vats', 'Sleep Cycles', 'Root Grafting'] },
  { anchor: 'divination', branch: 'magic', eff: 'gather:all', cost: { moon_dew: 4, incense: 3 }, time: 270, angle: 90, spread: 120, depth: 2, names: ['Clear Sight', 'Omen Diaries', 'Candle Smoke', 'Mirror Gazing', 'Bone Casting', 'Dream Logs', 'Crystal Gazing', 'Lot Casting'] },
  { anchor: 'crystal_attunement', branch: 'magic', eff: 'gather:mana_crystal', cost: { mana_crystal: 2 }, time: 270, angle: 90, spread: 70, depth: 2, names: ['Facet Tuning', 'Crystal Choirs', 'Deep Resonance', 'Lattice Sight', 'Dust Gathering', 'Charge Cycles'] },
  { anchor: 'high_rituals', branch: 'magic', eff: 'gather:all', cost: { incense: 4, salt: 4 }, time: 300, angle: -90, spread: 90, depth: 2, names: ['Incense Clouds', 'Long Chants', 'Offering Bowls', 'Sacred Geometry', 'Robe Weaving', 'Vigil Keeping'] },
  { anchor: 'enchantment', branch: 'magic', eff: 'gather:all', cost: { mana_dust: 5 }, time: 300, angle: 90, spread: 90, depth: 2, names: ['Sigil Polish', 'Whispered Names', 'Thread of Stars', 'Binding Knots', 'Glow Setting', 'Charm Chains'] },
  { anchor: 'ley_mastery', branch: 'magic', eff: 'gather:ley_essence', cost: { ley_essence: 2 }, time: 360, angle: 180, spread: 120, depth: 2, names: ['Deep Listening', 'World Veins', 'Essence Tides', 'Quiet Steps', 'Node Keys', 'Ley Repose', 'Songlines', 'Still Points'] },

  // ---- Magitech spine (center) ----------------------------------------------------
  { anchor: 'rune_engineering', branch: 'magitech', eff: 'both', cost: { iron_plate: 2, amber_pearl: 2 }, time: 300, angle: 0, spread: 90, depth: 2, names: ['Rune Files', 'Plate Stamps', 'Conduit Bends', 'Etch Baths', 'Inlay Wire', 'Steady Current'] },
  { anchor: 'voltite_arcana', branch: 'magitech', eff: 'both', cost: { voltite: 3 }, time: 420, angle: 180, spread: 90, depth: 2, names: ['Storm Jars', 'Charge Sigils', 'Lightning Lore', 'Insulated Gloves', 'Arc Reading', 'Thunder Timing'] },
  { anchor: 'aetherworks', branch: 'magitech', eff: 'both', cost: { cloth: 8, rope: 6 }, time: 480, angle: 0, spread: 110, depth: 2, radius: 230, names: ['Sky Legs', 'Ballast Bags', 'Wind Reading', 'Mast Rigging', 'Cloud Charts', 'Gentle Landings', 'Anchor Winches', 'Star Sextants'] },
  { anchor: 'wonders_of_spirit', branch: 'magitech', eff: 'both', cost: { mana_dust: 10, moon_silver: 2 }, time: 600, angle: 180, spread: 120, depth: 2, names: ['Beacon Keeping', 'Garden Songs', 'Nexus Tuning', 'Aurora Watch', 'Pilgrim Paths', 'World Blessings', 'Sky Choirs', 'Gentle Rains'] },
  { anchor: 'golemcraft', branch: 'magitech', eff: 'both', cost: { stone_brick: 12, mana_dust: 3 }, time: 360, angle: 0, spread: 90, depth: 2, names: ['Core Warmth', 'Stone Joints', 'Word of Waking', 'Patient Golems', 'Clay Skins', 'Heart Chambers'] },
  { anchor: 'runic_industry', branch: 'magitech', eff: 'both', cost: { rune_stone: 2, gear: 4 }, time: 420, angle: 180, spread: 90, depth: 2, names: ['Shift Bells', 'Rune Stencils', 'Press Timing', 'Inked Rollers', 'Quota Charms', 'Guild Marks'] },
  { anchor: 'arcane_machinery', branch: 'magitech', eff: 'both', cost: { arcane_alloy: 1, bolt_kit: 2 }, time: 480, angle: 0, spread: 90, depth: 2, names: ['Mana Manifolds', 'Alloy Quench', 'Engine Chants', 'Resonant Bolts', 'Soft Startups', 'Overflow Runes'] },
  { anchor: 'thinking_machines', branch: 'magitech', eff: 'both', cost: { circuit: 2, paper: 10 }, time: 540, angle: 180, spread: 110, depth: 2, radius: 230, names: ['Teaching Scrolls', 'Patience Drums', 'Logic Gardens', 'Error Bells', 'Memory Baths', 'Kind Words', 'Slow Answers', 'Oiled Thoughts'] },
  { anchor: 'wonders_of_matter', branch: 'magitech', eff: 'both', cost: { steel_plate: 8, stone_brick: 20 }, time: 600, angle: 0, spread: 120, depth: 2, names: ['Foundation Rites', 'Great Cranes', 'Master Plans', 'Stone Ballets', 'Crown Fitting', 'Eternal Gears', 'Brass Polish', 'Keystone Cuts'] },
];
