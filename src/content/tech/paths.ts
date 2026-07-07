import type { PathSpec } from './specs';

// Small-node chains along each same-branch major edge. Names become node ids
// (slugified), so keep them unique across the whole tree. Costs use resources
// the player is guaranteed to have unlocked by the path's `from` anchor.
export const PATHS: PathSpec[] = [
  // ---- Tech branch (right) ----------------------------------------------------
  { from: 'metallurgy', to: 'ironworking', branch: 'tech', eff: 'craft', cost: { copper_ingot: 2 }, time: 90, bow: 22, names: ['Ore Roasting', 'Bloomery Draft', 'Slag Tapping'] },
  { from: 'blueprints', to: 'toolmaking', branch: 'tech', eff: 'craft', cost: { plank: 5, paper: 2 }, time: 90, names: ['Standard Parts', 'Pattern Books', 'Apprentice Guilds'] },
  { from: 'ironworking', to: 'steelworks', branch: 'tech', eff: 'craft', cost: { iron_ingot: 3 }, time: 120, names: ['Coke Ovens', 'Hot Blast', 'Crucible Trials'] },
  { from: 'ironworking', to: 'claywork', branch: 'tech', eff: 'craft', cost: { iron_ingot: 2, stone: 8 }, time: 120, flip: true, names: ['Pit Kilns', 'Wedging Tables', 'Glaze Washes'] },
  { from: 'toolmaking', to: 'carpentry', branch: 'tech', eff: 'craft', cost: { plank: 8, nails: 6 }, time: 120, names: ['Joinery', 'Dovetails', 'Wood Cures'] },
  { from: 'claywork', to: 'glassworks', branch: 'tech', eff: 'craft', cost: { brick: 4, charcoal: 4 }, time: 150, names: ['Ash Glazes', 'Furnace Airways', 'Sand Sieving'] },
  { from: 'steelworks', to: 'construction', branch: 'tech', eff: 'craft', cost: { stone_brick: 8, iron_plate: 1 }, time: 150, flip: true, names: ['Mortar Mixes', 'Scaffolding', 'Plumb Lines'] },
  { from: 'steelworks', to: 'mechanisms', branch: 'tech', eff: 'craft', cost: { gear: 3 }, time: 150, names: ['Gear Cutting', 'Cam Profiles', 'Flywheels', 'Escapements'] },
  { from: 'glassworks', to: 'chemistry', branch: 'tech', eff: 'craft', cost: { glass: 4, charcoal: 6 }, time: 180, names: ['Distillation', 'Reagent Shelves', 'Retorts & Alembics'] },
  { from: 'mechanisms', to: 'plumbing', branch: 'tech', eff: 'craft', cost: { copper_ingot: 6, gear: 2 }, time: 180, names: ['Pipe Threading', 'Gasket Seals', 'Water Towers'] },
  { from: 'mechanisms', to: 'fine_machinery', branch: 'tech', eff: 'craft', cost: { gear: 4, glass: 2 }, time: 180, names: ['Fine Tooling', 'Jeweled Bearings', 'Micrometers'] },
  { from: 'plumbing', to: 'steam_power', branch: 'tech', eff: 'craft', cost: { pipe: 4, valve: 1 }, time: 240, names: ['Pressure Gauges', 'Safety Valves', 'Condensers'] },
  { from: 'fine_machinery', to: 'everyday_engineering', branch: 'tech', eff: 'craft', cost: { gearbox: 1, paper: 6 }, time: 240, names: ['Consumer Works', 'Assembly Benches', 'Catalogues'] },
  { from: 'fine_machinery', to: 'transport', branch: 'tech', eff: 'craft', cost: { wheel: 2, rope: 4 }, time: 240, flip: true, names: ['Cargo Rigging', 'Axle Grease', 'Wayfinding'] },
  { from: 'steam_power', to: 'oil_age', branch: 'tech', eff: 'craft', cost: { steel: 4, pipe: 4 }, time: 300, names: ['Seep Mapping', 'Deep Boreholes', 'Derrick Frames', 'Pipeline Sketches'] },
  { from: 'chemistry', to: 'oil_age', branch: 'tech', eff: 'craft', cost: { sulfur: 6, glass: 4 }, time: 300, flip: true, names: ['Cracking Theory', 'Solvent Refining', 'Tar Distilling', 'Naphtha Lamps'] },
  { from: 'steam_power', to: 'railworks', branch: 'tech', eff: 'craft', cost: { steel: 6, wooden_beam: 2 }, time: 300, names: ['Iron Roads', 'Gauge Standards', 'Switchyards'] },
  { from: 'oil_age', to: 'electricity', branch: 'tech', eff: 'craft', cost: { copper_wire: 12, plastic: 4 }, time: 300, names: ['Voltite Prospecting', 'Insulation', 'Dynamo Theory'] },
  { from: 'electricity', to: 'automation', branch: 'tech', eff: 'craft', cost: { circuit: 2, paper: 8 }, time: 360, names: ['Relay Logic', 'Punch Cards', 'Feedback Loops'] },
  { from: 'electricity', to: 'communications', branch: 'tech', eff: 'craft', cost: { copper_wire: 16, glass_tube: 2 }, time: 360, flip: true, names: ['Signal Codes', 'Line Repeaters', 'Switchboards'] },

  // ---- Magic branch (left) ------------------------------------------------------
  { from: 'sap_flow', to: 'sapcraft', branch: 'magic', eff: 'gather:wood', cost: { wood: 8, water: 6 }, time: 90, names: ['Tap Lines', 'Resin Beads', 'Bark Songs'] },
  { from: 'deep_roots', to: 'herbalism', branch: 'magic', eff: 'gather:all', cost: { water: 10, fiber: 6 }, time: 90, names: ['Meadow Walks', 'Root Cellars', 'Seed Blessings'] },
  { from: 'moon_tides', to: 'weaving', branch: 'magic', eff: 'gather:fiber', cost: { fiber: 12, rope: 2 }, time: 120, names: ['Spindle Whorls', 'Dye Vats', 'Warp & Weft'] },
  { from: 'herbalism', to: 'alchemy', branch: 'magic', eff: 'gather:herbs', cost: { herbs: 8, water: 8 }, time: 150, names: ['Mortar & Pestle', 'Tincture Racks', 'Bitter Brews'] },
  { from: 'herbalism', to: 'ambercraft', branch: 'magic', eff: 'gather:resin', cost: { resin: 6, herbs: 4 }, time: 150, names: ['Sap Harvest', 'Amber Sorting', 'Warm Hands'] },
  { from: 'alchemy', to: 'scrivenery', branch: 'magic', eff: 'gather:all', cost: { herbal_extract: 2, salt: 3 }, time: 180, names: ['Quill Cutting', 'Ink Stones', 'Margin Notes'] },
  { from: 'ambercraft', to: 'scrivenery', branch: 'magic', eff: 'gather:all', cost: { resin: 8, fiber: 6 }, time: 180, names: ['Wax Seals', 'Gilded Letters', 'Binding Cords'] },
  { from: 'alchemy', to: 'sporecraft', branch: 'magic', eff: 'gather:all', cost: { salt: 4, water: 12 }, time: 210, names: ['Damp Caves', 'Spore Prints', 'Mycelial Beds'] },
  { from: 'ambercraft', to: 'lunar_rites', branch: 'magic', eff: 'gather:all', cost: { amber_pearl: 2, water: 10 }, time: 210, names: ['Night Vigils', 'Silvered Bowls', 'Tide Charts'] },
  { from: 'lunar_rites', to: 'divination', branch: 'magic', eff: 'gather:moon_dew', cost: { moon_dew: 3, amber: 4 }, time: 240, names: ['Tea Leaves', 'Palmistry', 'Star Charts'] },
  { from: 'scrivenery', to: 'crystal_attunement', branch: 'magic', eff: 'gather:all', cost: { enchanted_ink: 2, spirit_water: 6 }, time: 240, names: ['Crystal Songs', 'Geode Hunting', 'Facet Reading'] },
  { from: 'sporecraft', to: 'vitalism', branch: 'magic', eff: 'gather:glowspore', cost: { glowspore: 6, herbal_extract: 3 }, time: 270, names: ['Living Cultures', 'Vital Sparks', 'Warm Vats'] },
  { from: 'crystal_attunement', to: 'high_rituals', branch: 'magic', eff: 'gather:all', cost: { mana_dust: 4, incense: 4 }, time: 300, names: ['Chalk Circles', 'Candle Vigils', 'Fasting Rites'] },
  { from: 'crystal_attunement', to: 'enchantment', branch: 'magic', eff: 'gather:mana_crystal', cost: { mana_dust: 4, amber_pearl: 2 }, time: 300, names: ['Sigil Practice', 'Mana Weaving', 'Thread Binding'] },
  { from: 'high_rituals', to: 'ley_mastery', branch: 'magic', eff: 'gather:all', cost: { rune_stone: 2, mana_dust: 6 }, time: 360, names: ['Ley Walking', 'Node Mapping', 'Deep Attunement'] },
  { from: 'enchantment', to: 'ley_mastery', branch: 'magic', eff: 'gather:all', cost: { moon_silver: 2, mana_dust: 6 }, time: 360, names: ['Essence Filtering', 'Star Metal', 'Silent Chants'] },

  // ---- Magitech spine (center) ----------------------------------------------------
  { from: 'spirit_pistons', to: 'rune_engineering', branch: 'magitech', eff: 'both', cost: { stone_brick: 6, rope: 2 }, time: 240, names: ['Etched Cylinders', 'Mana Gaskets', 'Rune Benches'] },
  { from: 'rune_engineering', to: 'voltite_arcana', branch: 'magitech', eff: 'both', cost: { copper_wire: 10, rune_plate: 1 }, time: 360, names: ['Charged Etchings', 'Storm Watching', 'Copper Runes'] },
  { from: 'voltite_arcana', to: 'aetherworks', branch: 'magitech', eff: 'both', cost: { mana_battery: 1, mana_dust: 8 }, time: 480, names: ['Lift Theory', 'Aether Sails', 'Sky Trials'] },
  { from: 'aetherworks', to: 'wonders_of_spirit', branch: 'magitech', eff: 'both', cost: { ley_thread: 3, mana_dust: 8 }, time: 600, names: ['Horizon Charts', 'High Altars', 'Spirit Beacons'] },
  { from: 'arcane_engine', to: 'golemcraft', branch: 'magitech', eff: 'both', cost: { plank: 10, rope: 4 }, time: 300, names: ['Clay Effigies', 'Binding Words', 'Waking Rites'] },
  { from: 'golemcraft', to: 'runic_industry', branch: 'magitech', eff: 'both', cost: { steel: 4, rune_stone: 1 }, time: 360, names: ['Golem Foremen', 'Chisel Choirs', 'Work Chants'] },
  { from: 'runic_industry', to: 'arcane_machinery', branch: 'magitech', eff: 'both', cost: { steel: 6, mana_dust: 6 }, time: 420, names: ['Mana Flywheels', 'Alloy Trials', 'Humming Frames'] },
  { from: 'arcane_machinery', to: 'thinking_machines', branch: 'magitech', eff: 'both', cost: { steel_plate: 2, mana_dust: 8 }, time: 480, names: ['Logic Runes', 'Memory Crystals', 'Question Engines'] },
  { from: 'thinking_machines', to: 'wonders_of_matter', branch: 'magitech', eff: 'both', cost: { steel_plate: 6, rune_stone: 3 }, time: 600, names: ['Grand Designs', 'Deep Foundations', 'Master Guilds'] },
];
