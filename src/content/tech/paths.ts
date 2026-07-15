import type { PathSpec } from './specs';

// Small-node chains along each same-branch major edge. Names become node ids
// (slugified), so keep them unique across the whole tree. Costs use resources
// the player is guaranteed to have unlocked by the path's `from` anchor and
// only set the resource MIX — the global cost curve (index.ts) sets amounts.
// `time` is per NODE and scales with the era the chain leads into (minutes
// early, hours late).
export const PATHS: PathSpec[] = [
  // ---- Tech branch (right) ----------------------------------------------------
  { from: 'metallurgy', to: 'ironworking', branch: 'tech', eff: 'craft', cost: { copper_ingot: 4, stone_brick: 4 }, time: 180, bow: 22, names: ['Ore Roasting', 'Bloomery Draft', 'Slag Tapping'] },
  { from: 'blueprints', to: 'toolmaking', branch: 'tech', eff: 'craft', cost: { plank: 10, paper: 6 }, time: 240, names: ['Standard Parts', 'Pattern Books', 'Apprentice Guilds'] },
  { from: 'ironworking', to: 'steelworks', branch: 'tech', eff: 'craft', cost: { iron_ingot: 6, charcoal: 8 }, time: 360, names: ['Coke Ovens', 'Hot Blast', 'Crucible Trials'] },
  { from: 'ironworking', to: 'claywork', branch: 'tech', eff: 'craft', cost: { iron_ingot: 5, stone: 16 }, time: 360, flip: true, names: ['Pit Kilns', 'Wedging Tables', 'Glaze Washes'] },
  { from: 'toolmaking', to: 'carpentry', branch: 'tech', eff: 'craft', cost: { plank: 16, nails: 10, saw: 1 }, time: 360, names: ['Joinery', 'Dovetails', 'Wood Cures'] },
  { from: 'claywork', to: 'glassworks', branch: 'tech', eff: 'craft', cost: { brick: 8, charcoal: 10 }, time: 600, names: ['Ash Glazes', 'Furnace Airways', 'Sand Sieving'] },
  { from: 'steelworks', to: 'construction', branch: 'tech', eff: 'craft', cost: { stone_brick: 16, iron_plate: 3 }, time: 600, flip: true, names: ['Mortar Mixes', 'Scaffolding', 'Plumb Lines'] },
  { from: 'steelworks', to: 'mechanisms', branch: 'tech', eff: 'craft', cost: { gear: 6, steel: 3 }, time: 600, names: ['Gear Cutting', 'Cam Profiles', 'Flywheels', 'Escapements'] },
  { from: 'glassworks', to: 'chemistry', branch: 'tech', eff: 'craft', cost: { glass: 8, charcoal: 12 }, time: 900, names: ['Distillation', 'Reagent Shelves', 'Retorts & Alembics'] },
  { from: 'mechanisms', to: 'plumbing', branch: 'tech', eff: 'craft', cost: { copper_ingot: 12, gear: 5 }, time: 1200, names: ['Pipe Threading', 'Gasket Seals', 'Water Towers'] },
  { from: 'mechanisms', to: 'fine_machinery', branch: 'tech', eff: 'craft', cost: { gear: 8, glass: 5 }, time: 1200, names: ['Fine Tooling', 'Jeweled Bearings', 'Micrometers'] },
  { from: 'plumbing', to: 'steam_power', branch: 'tech', eff: 'craft', cost: { pipe: 8, valve: 3 }, time: 1800, names: ['Pressure Gauges', 'Safety Valves', 'Condensers'] },
  { from: 'fine_machinery', to: 'everyday_engineering', branch: 'tech', eff: 'craft', cost: { gearbox: 2, paper: 16 }, time: 1800, names: ['Consumer Works', 'Assembly Benches', 'Catalogues'] },
  { from: 'fine_machinery', to: 'transport', branch: 'tech', eff: 'craft', cost: { wheel: 4, rope: 8 }, time: 1800, flip: true, names: ['Cargo Rigging', 'Axle Grease', 'Wayfinding'] },
  { from: 'steam_power', to: 'oil_age', branch: 'tech', eff: 'craft', cost: { steel: 10, pipe: 8 }, time: 2700, names: ['Seep Mapping', 'Deep Boreholes', 'Derrick Frames', 'Pipeline Sketches'] },
  { from: 'chemistry', to: 'oil_age', branch: 'tech', eff: 'craft', cost: { sulfur: 12, glass: 8 }, time: 2700, flip: true, names: ['Cracking Theory', 'Solvent Refining', 'Tar Distilling', 'Naphtha Lamps'] },
  { from: 'steam_power', to: 'railworks', branch: 'tech', eff: 'craft', cost: { steel: 12, wooden_beam: 6 }, time: 2700, names: ['Iron Roads', 'Gauge Standards', 'Switchyards'] },
  { from: 'oil_age', to: 'electricity', branch: 'tech', eff: 'craft', cost: { copper_wire: 24, plastic: 10 }, time: 3600, names: ['Voltite Prospecting', 'Insulation', 'Dynamo Theory'] },
  { from: 'electricity', to: 'automation', branch: 'tech', eff: 'craft', cost: { circuit: 4, paper: 20 }, time: 5400, names: ['Relay Logic', 'Punch Cards', 'Feedback Loops'] },
  { from: 'electricity', to: 'communications', branch: 'tech', eff: 'craft', cost: { copper_wire: 40, glass_tube: 4 }, time: 5400, flip: true, names: ['Signal Codes', 'Line Repeaters', 'Switchboards'] },

  // ---- Magic branch (left) ------------------------------------------------------
  { from: 'sap_flow', to: 'sapcraft', branch: 'magic', eff: 'gather:wood', cost: { wood: 16, water: 12 }, time: 180, names: ['Tap Lines', 'Resin Beads', 'Bark Songs'] },
  { from: 'deep_roots', to: 'herbalism', branch: 'magic', eff: 'gather:all', cost: { water: 20, fiber: 12 }, time: 180, names: ['Meadow Walks', 'Root Cellars', 'Seed Blessings'] },
  { from: 'moon_tides', to: 'weaving', branch: 'magic', eff: 'gather:fiber', cost: { fiber: 24, rope: 4 }, time: 240, names: ['Spindle Whorls', 'Dye Vats', 'Warp & Weft'] },
  { from: 'herbalism', to: 'alchemy', branch: 'magic', eff: 'gather:herbs', cost: { herbs: 16, spirit_water: 6 }, time: 360, names: ['Mortar & Pestle', 'Tincture Racks', 'Bitter Brews'] },
  { from: 'herbalism', to: 'ambercraft', branch: 'magic', eff: 'gather:resin', cost: { resin: 12, herbal_extract: 4 }, time: 360, names: ['Sap Harvest', 'Amber Sorting', 'Warm Hands'] },
  { from: 'alchemy', to: 'scrivenery', branch: 'magic', eff: 'gather:all', cost: { herbal_extract: 6, salt: 8 }, time: 600, names: ['Quill Cutting', 'Ink Stones', 'Margin Notes'] },
  { from: 'ambercraft', to: 'scrivenery', branch: 'magic', eff: 'gather:all', cost: { resin: 16, amber_pearl: 2 }, time: 600, names: ['Wax Seals', 'Gilded Letters', 'Binding Cords'] },
  { from: 'alchemy', to: 'sporecraft', branch: 'magic', eff: 'gather:all', cost: { salt: 10, herbal_extract: 6 }, time: 900, names: ['Damp Caves', 'Spore Prints', 'Mycelial Beds'] },
  { from: 'ambercraft', to: 'lunar_rites', branch: 'magic', eff: 'gather:all', cost: { amber_pearl: 4, spirit_water: 10 }, time: 900, names: ['Night Vigils', 'Silvered Bowls', 'Tide Charts'] },
  { from: 'lunar_rites', to: 'divination', branch: 'magic', eff: 'gather:moon_dew', cost: { moon_dew: 6, moon_elixir: 2 }, time: 1800, names: ['Tea Leaves', 'Palmistry', 'Star Charts'] },
  { from: 'scrivenery', to: 'crystal_attunement', branch: 'magic', eff: 'gather:all', cost: { enchanted_ink: 4, grimoire: 1 }, time: 1800, names: ['Crystal Songs', 'Geode Hunting', 'Facet Reading'] },
  { from: 'sporecraft', to: 'vitalism', branch: 'magic', eff: 'gather:glowspore', cost: { glowspore: 12, glow_paste: 4 }, time: 1800, names: ['Living Cultures', 'Vital Sparks', 'Warm Vats'] },
  { from: 'crystal_attunement', to: 'high_rituals', branch: 'magic', eff: 'gather:all', cost: { mana_dust: 8, incense: 10 }, time: 3600, names: ['Chalk Circles', 'Candle Vigils', 'Fasting Rites'] },
  { from: 'crystal_attunement', to: 'enchantment', branch: 'magic', eff: 'gather:mana_crystal', cost: { mana_dust: 8, rune_ring: 1 }, time: 3600, names: ['Sigil Practice', 'Mana Weaving', 'Thread Binding'] },
  { from: 'high_rituals', to: 'ley_mastery', branch: 'magic', eff: 'gather:all', cost: { rune_stone: 4, summoning_circle: 1 }, time: 7200, names: ['Ley Walking', 'Node Mapping', 'Deep Attunement'] },
  { from: 'enchantment', to: 'ley_mastery', branch: 'magic', eff: 'gather:all', cost: { moon_silver: 4, amulet: 1 }, time: 7200, names: ['Essence Filtering', 'Star Metal', 'Silent Chants'] },

  // ---- Magitech spine (center) ----------------------------------------------------
  { from: 'spirit_pistons', to: 'rune_engineering', branch: 'magitech', eff: 'both', cost: { stone_brick: 12, rope: 6 }, time: 900, names: ['Etched Cylinders', 'Mana Gaskets', 'Rune Benches'] },
  { from: 'rune_engineering', to: 'voltite_arcana', branch: 'magitech', eff: 'both', cost: { copper_wire: 20, rune_plate: 2 }, time: 5400, names: ['Charged Etchings', 'Storm Watching', 'Copper Runes'] },
  { from: 'voltite_arcana', to: 'aetherworks', branch: 'magitech', eff: 'both', cost: { mana_battery: 1, mana_dust: 16 }, time: 10800, names: ['Lift Theory', 'Aether Sails', 'Sky Trials'] },
  { from: 'aetherworks', to: 'wonders_of_spirit', branch: 'magitech', eff: 'both', cost: { ley_thread: 6, mana_dust: 20 }, time: 21600, names: ['Horizon Charts', 'High Altars', 'Spirit Beacons'] },
  { from: 'arcane_engine', to: 'golemcraft', branch: 'magitech', eff: 'both', cost: { plank: 24, rope: 8 }, time: 1800, names: ['Clay Effigies', 'Binding Words', 'Waking Rites'] },
  { from: 'golemcraft', to: 'runic_industry', branch: 'magitech', eff: 'both', cost: { steel: 8, rune_stone: 2 }, time: 5400, names: ['Golem Foremen', 'Chisel Choirs', 'Work Chants'] },
  { from: 'runic_industry', to: 'arcane_machinery', branch: 'magitech', eff: 'both', cost: { steel: 12, mana_dust: 12 }, time: 7200, names: ['Mana Flywheels', 'Alloy Trials', 'Humming Frames'] },
  { from: 'arcane_machinery', to: 'thinking_machines', branch: 'magitech', eff: 'both', cost: { steel_plate: 4, rune_circuit: 1 }, time: 10800, names: ['Logic Runes', 'Memory Crystals', 'Question Engines'] },
  { from: 'thinking_machines', to: 'wonders_of_matter', branch: 'magitech', eff: 'both', cost: { steel_plate: 10, rune_stone: 6 }, time: 21600, names: ['Grand Designs', 'Deep Foundations', 'Master Guilds'] },
];
