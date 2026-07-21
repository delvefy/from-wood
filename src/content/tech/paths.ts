import type { PathSpec } from './specs';

// The 51 authored small +1% nodes, as chains along major->major edges:
// 8 tech, 15 magic, 14 spirit spine, 14 matter spine. Names become node
// ids (slugified), so keep them unique tree-wide. Every small node gives
// +1% gather and +1% craft (+2% each on the magitech spines) — effects are
// fixed by branch in index.ts. Costs use resources the player is guaranteed
// to have unlocked by the path's `from` anchor and only set the resource
// MIX — the global cost curve (index.ts) sets amounts.
// `time` is the AUTHORED seconds of the chain's first node; each later node
// runs 1.3× the previous, which also ramps its cost via the value curve.
//
// The four branch openers — Sharp Tools, Wood Attunement, Runic Saws and
// Mana Lathe — are, with the root, the five cheap-and-fast starter nodes
// (overridden at read time in index.ts).
export const PATHS: PathSpec[] = [
  // ---- Tech branch (right, 8 smalls) ---------------------------------------------
  { from: 'basic_tools', to: 'woodworking', branch: 'tech', cost: { wood: 6, water: 3 }, time: 45, names: ['Sharp Tools', 'Measured Cuts'], bow: 60 },
  { from: 'woodworking', to: 'quarrying', branch: 'tech', cost: { wood: 12, water: 6 }, time: 90, names: ['Jigs & Fixtures'] },
  { from: 'quarrying', to: 'metallurgy', branch: 'tech', cost: { stone: 10, wood: 10 }, time: 150, names: ['Ore Roasting'] },
  { from: 'metallurgy', to: 'ironworking', branch: 'tech', cost: { copper_ingot: 4, stone_brick: 4 }, time: 300, names: ['Bloomery Draft'] },
  { from: 'ironworking', to: 'toolmaking', branch: 'tech', cost: { plank: 10, iron_ingot: 4 }, time: 600, names: ['Standard Parts'] },
  { from: 'ironworking', to: 'steelworks', branch: 'tech', cost: { iron_ingot: 6, charcoal: 8 }, time: 900, names: ['Hot Blast'] },
  { from: 'mechanisms', to: 'fine_machinery', branch: 'tech', cost: { gear: 8, glass: 5 }, time: 4800, names: ['Fine Tooling'] },

  // ---- Magic branch (left, 15 smalls) ----------------------------------------------
  { from: 'basic_tools', to: 'rope_making', branch: 'magic', cost: { water: 5, wood: 3 }, time: 45, names: ['Wood Attunement', 'Water Attunement'], flip: true },
  { from: 'rope_making', to: 'sapcraft', branch: 'magic', cost: { wood: 16, water: 12 }, time: 300, names: ['Sap Flow'] },
  { from: 'rope_making', to: 'herbalism', branch: 'magic', cost: { water: 20, fiber: 12 }, time: 240, names: ['Verdant Whisper', 'Deep Roots'] },
  { from: 'rope_making', to: 'weaving', branch: 'magic', cost: { fiber: 16, water: 16 }, time: 300, names: ['Spring Song', 'Moon Tides'], bow: -60 },
  { from: 'herbalism', to: 'alchemy', branch: 'magic', cost: { herbs: 16, spirit_water: 6 }, time: 1200, names: ['Mortar & Pestle'] },
  { from: 'herbalism', to: 'ambercraft', branch: 'magic', cost: { resin: 12, herbal_extract: 4 }, time: 1200, names: ['Sap Harvest'] },
  { from: 'alchemy', to: 'scrivenery', branch: 'magic', cost: { herbal_extract: 6, salt: 8 }, time: 2400, names: ['Quill Cutting'] },
  { from: 'alchemy', to: 'sporecraft', branch: 'magic', cost: { salt: 10, herbal_extract: 6 }, time: 2400, names: ['Spore Prints'] },
  { from: 'ambercraft', to: 'lunar_rites', branch: 'magic', cost: { amber_pearl: 4, spirit_water: 10 }, time: 2400, names: ['Night Vigils'], bow: 80 },
  { from: 'sporecraft', to: 'vitalism', branch: 'magic', cost: { glowspore: 12, glow_paste: 4 }, time: 4800, names: ['Living Cultures'] },
  { from: 'lunar_rites', to: 'divination', branch: 'magic', cost: { moon_dew: 6, moon_elixir: 2 }, time: 4800, names: ['Tea Leaves'] },
  { from: 'scrivenery', to: 'crystal_attunement', branch: 'magic', cost: { enchanted_ink: 4, grimoire: 1 }, time: 4800, names: ['Crystal Songs'] },

  // ---- Magitech spirit spine (14 smalls) ---------------------------------------------
  { from: 'basic_tools', to: 'spirit_pistons', branch: 'magitech', cost: { wood: 12, water: 8 }, time: 60, names: ['Runic Saws', 'Spirit Valves', 'Spirit Beacons'] },
  { from: 'spirit_pistons', to: 'rune_engineering', branch: 'magitech', cost: { stone_brick: 12, rope: 6 }, time: 900, names: ['Etched Cylinders', 'Mana Gaskets', 'Rune Benches'] },
  { from: 'rune_engineering', to: 'voltite_arcana', branch: 'magitech', cost: { copper_wire: 20, rune_plate: 2 }, time: 5400, names: ['Charged Etchings', 'Storm Watching', 'Copper Runes', 'Sky Trials'] },
  { from: 'voltite_arcana', to: 'aetherworks', branch: 'magitech', cost: { mana_battery: 1, mana_dust: 16 }, time: 10800, names: ['Lift Theory', 'Aether Sails'] },
  { from: 'aetherworks', to: 'wonders_of_spirit', branch: 'magitech', cost: { ley_thread: 6, mana_dust: 20 }, time: 21600, names: ['Horizon Charts', 'High Altars'] },

  // ---- Magitech matter spine (14 smalls) ---------------------------------------------
  { from: 'basic_tools', to: 'arcane_engine', branch: 'magitech', cost: { wood: 12, water: 12 }, time: 60, names: ['Mana Lathe', 'Singing Gears', 'Humming Frames'] },
  { from: 'arcane_engine', to: 'golemcraft', branch: 'magitech', cost: { plank: 24, rope: 8 }, time: 1800, names: ['Clay Effigies', 'Binding Words', 'Waking Rites', 'Work Chants'] },
  { from: 'golemcraft', to: 'runic_industry', branch: 'magitech', cost: { steel: 8, rune_stone: 2 }, time: 5400, names: ['Golem Foremen', 'Rune Stencils'] },
  { from: 'runic_industry', to: 'arcane_machinery', branch: 'magitech', cost: { steel: 12, mana_dust: 12 }, time: 7200, names: ['Mana Flywheels', 'Alloy Trials'] },
  { from: 'arcane_machinery', to: 'thinking_machines', branch: 'magitech', cost: { steel_plate: 4, rune_circuit: 1 }, time: 14400, names: ['Logic Runes', 'Memory Crystals'] },
  { from: 'thinking_machines', to: 'wonders_of_matter', branch: 'magitech', cost: { steel_plate: 10, rune_stone: 6 }, time: 28800, names: ['Grand Designs'] },
];
