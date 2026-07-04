import type { TechNode } from '../engine/types';

// PoE-style skill tree on an infinite canvas. Root sits at (0, 0); the Magic
// branch grows LEFT (x < 0), the Tech branch grows RIGHT (x > 0), and Magitech
// hybrids run along the vertical spine (x = 0) — each spine node requires one
// node from each side, which is where the branches intermingle.
//
// Design rules:
// - No speed effects anywhere. Only efficiency: small additive percents
//   (+1% per small node, +2% on majors) to gather yield or craft output.
// - `major` nodes unlock content (resources/recipes) or anchor the spine and
//   render larger.
// - Coordinates are world px; keep ~150px between connected nodes.
export const TECH: TechNode[] = [
  // ---- Root ------------------------------------------------------------------
  {
    id: 'basic_tools',
    name: 'Basic Tools',
    description: 'Gather efficiency +2%',
    cost: { wood: 3, water: 2 },
    researchTimeSeconds: 30,
    requires: [],
    effects: [{ kind: 'gatherEfficiency', resource: 'all', percent: 2 }],
    branch: 'magitech',
    x: 0,
    y: 0,
    major: true,
  },

  // ---- Magic branch (left) -----------------------------------------------------
  {
    id: 'attune_wood',
    name: 'Wood Attunement',
    description: 'Wood yield +1%',
    cost: { water: 3 },
    researchTimeSeconds: 30,
    requires: ['basic_tools'],
    effects: [{ kind: 'gatherEfficiency', resource: 'wood', percent: 1 }],
    branch: 'magic',
    x: -150,
    y: -90,
  },
  {
    id: 'attune_water',
    name: 'Water Attunement',
    description: 'Water yield +1%',
    cost: { wood: 3 },
    researchTimeSeconds: 30,
    requires: ['basic_tools'],
    effects: [{ kind: 'gatherEfficiency', resource: 'water', percent: 1 }],
    branch: 'magic',
    x: -150,
    y: 90,
  },
  {
    id: 'sap_flow',
    name: 'Sap Flow',
    description: 'Wood yield +1%',
    cost: { water: 5 },
    researchTimeSeconds: 45,
    requires: ['attune_wood'],
    effects: [{ kind: 'gatherEfficiency', resource: 'wood', percent: 1 }],
    branch: 'magic',
    x: -300,
    y: -180,
  },
  {
    id: 'spring_song',
    name: 'Spring Song',
    description: 'Water yield +1%',
    cost: { wood: 5 },
    researchTimeSeconds: 45,
    requires: ['attune_water'],
    effects: [{ kind: 'gatherEfficiency', resource: 'water', percent: 1 }],
    branch: 'magic',
    x: -300,
    y: 180,
  },
  {
    id: 'rope_making',
    name: 'Fiber Binding',
    description: 'Unlocks Fiber + Rope',
    cost: { wood: 4, water: 4 },
    researchTimeSeconds: 60,
    requires: ['attune_wood'],
    effects: [
      { kind: 'unlockResource', id: 'fiber' },
      { kind: 'unlockRecipe', id: 'rope' },
    ],
    branch: 'magic',
    x: -300,
    y: 0,
    major: true,
  },
  {
    id: 'verdant_whisper',
    name: 'Verdant Whisper',
    description: 'Gather efficiency +1%',
    cost: { fiber: 4 },
    researchTimeSeconds: 60,
    requires: ['rope_making'],
    effects: [{ kind: 'gatherEfficiency', resource: 'all', percent: 1 }],
    branch: 'magic',
    x: -450,
    y: 90,
  },
  {
    id: 'ley_sense',
    name: 'Ley Sense',
    description: 'Gather efficiency +1%',
    cost: { fiber: 4, water: 4 },
    researchTimeSeconds: 60,
    requires: ['rope_making'],
    effects: [{ kind: 'gatherEfficiency', resource: 'all', percent: 1 }],
    branch: 'magic',
    x: -450,
    y: -90,
  },
  {
    id: 'stone_spirits',
    name: 'Stone Spirits',
    description: 'Stone yield +1%',
    cost: { fiber: 6, water: 6 },
    researchTimeSeconds: 90,
    requires: ['ley_sense'],
    effects: [{ kind: 'gatherEfficiency', resource: 'stone', percent: 1 }],
    branch: 'magic',
    x: -600,
    y: -180,
  },
  {
    id: 'deep_roots',
    name: 'Deep Roots',
    description: 'Gather efficiency +1%',
    cost: { rope: 2 },
    researchTimeSeconds: 90,
    requires: ['verdant_whisper'],
    effects: [{ kind: 'gatherEfficiency', resource: 'all', percent: 1 }],
    branch: 'magic',
    x: -600,
    y: 0,
  },
  {
    id: 'moon_tides',
    name: 'Moon Tides',
    description: 'Water yield +1%',
    cost: { rope: 3, water: 8 },
    researchTimeSeconds: 120,
    requires: ['deep_roots'],
    effects: [{ kind: 'gatherEfficiency', resource: 'water', percent: 1 }],
    branch: 'magic',
    x: -750,
    y: 90,
  },

  // ---- Tech branch (right) ----------------------------------------------------
  {
    id: 'sharp_tools',
    name: 'Sharp Tools',
    description: 'Craft output +1%',
    cost: { wood: 4 },
    researchTimeSeconds: 30,
    requires: ['basic_tools'],
    effects: [{ kind: 'craftEfficiency', percent: 1 }],
    branch: 'tech',
    x: 150,
    y: -90,
  },
  {
    id: 'measured_cuts',
    name: 'Measured Cuts',
    description: 'Craft output +1%',
    cost: { wood: 4, water: 2 },
    researchTimeSeconds: 30,
    requires: ['basic_tools'],
    effects: [{ kind: 'craftEfficiency', percent: 1 }],
    branch: 'tech',
    x: 150,
    y: 90,
  },
  {
    id: 'woodworking',
    name: 'Woodworking',
    description: 'Unlocks the Planks recipe',
    cost: { wood: 5, water: 2 },
    researchTimeSeconds: 60,
    requires: ['sharp_tools'],
    effects: [{ kind: 'unlockRecipe', id: 'planks' }],
    branch: 'tech',
    x: 300,
    y: 0,
    major: true,
  },
  {
    id: 'quarrying',
    name: 'Quarrying',
    description: 'Unlocks Stone + Stone Bricks',
    cost: { wood: 6, water: 3 },
    researchTimeSeconds: 60,
    requires: ['sharp_tools'],
    effects: [
      { kind: 'unlockResource', id: 'stone' },
      { kind: 'unlockRecipe', id: 'stone_brick' },
    ],
    branch: 'tech',
    x: 300,
    y: -180,
    major: true,
  },
  {
    id: 'jigs',
    name: 'Jigs & Fixtures',
    description: 'Craft output +1%',
    cost: { wood: 6 },
    researchTimeSeconds: 45,
    requires: ['measured_cuts'],
    effects: [{ kind: 'craftEfficiency', percent: 1 }],
    branch: 'tech',
    x: 300,
    y: 180,
  },
  {
    id: 'tight_tolerances',
    name: 'Tight Tolerances',
    description: 'Craft output +1%',
    cost: { plank: 3 },
    researchTimeSeconds: 60,
    requires: ['woodworking'],
    effects: [{ kind: 'craftEfficiency', percent: 1 }],
    branch: 'tech',
    x: 450,
    y: 90,
  },
  {
    id: 'metallurgy',
    name: 'Metallurgy',
    description: 'Unlocks Copper + Iron Ore, Copper Ingots',
    cost: { stone: 6, wood: 8 },
    researchTimeSeconds: 90,
    requires: ['quarrying'],
    effects: [
      { kind: 'unlockResource', id: 'copper_ore' },
      { kind: 'unlockResource', id: 'iron_ore' },
      { kind: 'unlockRecipe', id: 'copper_ingot' },
    ],
    branch: 'tech',
    x: 450,
    y: -90,
    major: true,
  },
  {
    id: 'flux_baths',
    name: 'Flux Baths',
    description: 'Craft output +1%',
    cost: { stone_brick: 2 },
    researchTimeSeconds: 90,
    requires: ['metallurgy'],
    effects: [{ kind: 'craftEfficiency', percent: 1 }],
    branch: 'tech',
    x: 600,
    y: -180,
  },
  {
    id: 'grindstones',
    name: 'Grindstones',
    description: 'Craft output +1%',
    cost: { plank: 4, stone: 4 },
    researchTimeSeconds: 90,
    requires: ['metallurgy', 'tight_tolerances'],
    effects: [{ kind: 'craftEfficiency', percent: 1 }],
    branch: 'tech',
    x: 600,
    y: 0,
  },
  {
    id: 'blueprints',
    name: 'Blueprints',
    description: 'Craft output +1%',
    cost: { plank: 6 },
    researchTimeSeconds: 120,
    requires: ['grindstones'],
    effects: [{ kind: 'craftEfficiency', percent: 1 }],
    branch: 'tech',
    x: 750,
    y: 90,
  },

  // ---- Magitech spine (center) — requires one node from EACH side --------------
  {
    id: 'runic_saws',
    name: 'Runic Saws',
    description: 'Gather +1%, craft output +1%',
    cost: { wood: 6, water: 4 },
    researchTimeSeconds: 60,
    requires: ['attune_wood', 'sharp_tools'],
    effects: [
      { kind: 'gatherEfficiency', resource: 'all', percent: 1 },
      { kind: 'craftEfficiency', percent: 1 },
    ],
    branch: 'magitech',
    x: 0,
    y: -180,
  },
  {
    id: 'mana_lathe',
    name: 'Mana Lathe',
    description: 'Gather +1%, craft output +1%',
    cost: { wood: 6, water: 6 },
    researchTimeSeconds: 60,
    requires: ['attune_water', 'measured_cuts'],
    effects: [
      { kind: 'gatherEfficiency', resource: 'all', percent: 1 },
      { kind: 'craftEfficiency', percent: 1 },
    ],
    branch: 'magitech',
    x: 0,
    y: 180,
  },
  {
    id: 'spirit_pistons',
    name: 'Spirit Pistons',
    description: 'Gather +2%, craft output +2%',
    cost: { stone: 8, wood: 12 },
    researchTimeSeconds: 120,
    requires: ['runic_saws', 'ley_sense', 'quarrying'],
    effects: [
      { kind: 'gatherEfficiency', resource: 'all', percent: 2 },
      { kind: 'craftEfficiency', percent: 2 },
    ],
    branch: 'magitech',
    x: 0,
    y: -360,
    major: true,
  },
  {
    id: 'arcane_engine',
    name: 'Arcane Engine',
    description: 'Gather +2%, craft output +2%',
    cost: { plank: 6, rope: 3 },
    researchTimeSeconds: 150,
    requires: ['mana_lathe', 'verdant_whisper', 'tight_tolerances'],
    effects: [
      { kind: 'gatherEfficiency', resource: 'all', percent: 2 },
      { kind: 'craftEfficiency', percent: 2 },
    ],
    branch: 'magitech',
    x: 0,
    y: 360,
    major: true,
  },

  // ---- Era unlock nodes ---------------------------------------------------------
  // Each major below unlocks a themed batch of recipes (plus any new raw
  // resource) and grants the standard +2% major bonus. Batches keep the
  // ~200-recipe catalog reachable without authoring one node per recipe;
  // split batches into smaller nodes later as the tree fills in.
  ...eraNodes(),
];

// Compact authoring format for era unlock nodes.
interface EraNode {
  id: string;
  name: string;
  description: string;
  branch: 'magic' | 'tech' | 'magitech';
  x: number;
  y: number;
  requires: string[];
  cost: Record<string, number>;
  time: number;
  resources?: string[]; // unlockResource effects
  recipes: string[]; // unlockRecipe effects
}

function eraNodes(): TechNode[] {
  const nodes: EraNode[] = [
    // ---- Tech branch (right) ----------------------------------------------------
    { id: 'ironworking', name: 'Ironworking', description: 'Coal, iron smelting and basic metal stock', branch: 'tech', x: 900, y: -90, requires: ['metallurgy'], cost: { copper_ingot: 4, stone: 10 }, time: 120, resources: ['coal'], recipes: ['charcoal', 'iron_ingot', 'nails', 'iron_rod', 'iron_plate', 'copper_wire', 'gear', 'furnace', 'forge_bellows'] },
    { id: 'toolmaking', name: 'Toolmaking', description: 'Handles and the basic hand-tool set', branch: 'tech', x: 900, y: 90, requires: ['blueprints'], cost: { iron_ingot: 4, plank: 8 }, time: 150, recipes: ['handle', 'hammer', 'saw', 'chisel', 'hatchet', 'pickaxe', 'shovel'] },
    { id: 'carpentry', name: 'Carpentry', description: 'Beams, frames, paper and wooden furniture', branch: 'tech', x: 1050, y: 180, requires: ['toolmaking'], cost: { plank: 12, nails: 12 }, time: 180, recipes: ['wooden_beam', 'wooden_frame', 'paper', 'crate', 'bucket', 'table', 'chair', 'barrel'] },
    { id: 'claywork', name: 'Claywork', description: 'Clay pits, bricks, ceramics and the kiln', branch: 'tech', x: 1050, y: -180, requires: ['ironworking'], cost: { stone_brick: 8, water: 10 }, time: 180, resources: ['clay'], recipes: ['brick', 'ceramic', 'pottery_dishes', 'kiln'] },
    { id: 'steelworks', name: 'Steelworks', description: 'Steel smelting and heavy metal stock', branch: 'tech', x: 1200, y: -90, requires: ['ironworking'], cost: { iron_plate: 4, coal: 10 }, time: 240, recipes: ['steel', 'steel_plate', 'blade', 'spring', 'bolt_kit', 'chain', 'anvil', 'scythe', 'blast_furnace'] },
    { id: 'glassworks', name: 'Glassworks', description: 'Quartz sand, glass and optics', branch: 'tech', x: 1200, y: -270, requires: ['claywork'], cost: { brick: 8, coal: 6 }, time: 240, resources: ['quartz_sand'], recipes: ['glass', 'lens', 'glass_tube', 'window', 'mirror', 'spyglass', 'vial', 'lantern'] },
    { id: 'mechanisms', name: 'Mechanisms', description: 'Wheels, gearboxes and simple machines', branch: 'tech', x: 1350, y: 0, requires: ['steelworks', 'carpentry'], cost: { gear: 8, plank: 12 }, time: 300, recipes: ['hinge', 'bracket', 'crank', 'pulley_block', 'wheel', 'axle_assembly', 'gearbox', 'sawmill', 'waterwheel', 'windmill', 'loom_machine'] },
    { id: 'construction', name: 'Construction', description: 'Pillars, arches and fitted interiors', branch: 'tech', x: 1350, y: -180, requires: ['steelworks'], cost: { stone_brick: 16, iron_plate: 4 }, time: 300, recipes: ['stone_pillar', 'arch', 'door', 'cabinet', 'workbench', 'stove'] },
    { id: 'fine_machinery', name: 'Fine Machinery', description: 'Precision instruments and clockwork', branch: 'tech', x: 1500, y: 90, requires: ['mechanisms'], cost: { gearbox: 2, glass: 4 }, time: 360, recipes: ['clock', 'music_box', 'printing_press', 'measuring_kit', 'hand_drill', 'wrench', 'magnifier'] },
    { id: 'transport', name: 'Transport', description: 'Carts and boats', branch: 'tech', x: 1650, y: 90, requires: ['fine_machinery'], cost: { wheel: 4, plank: 20 }, time: 360, recipes: ['cart', 'wheelbarrow', 'rowboat', 'sailboat'] },
    { id: 'plumbing', name: 'Plumbing', description: 'Pipes, valves and pressure vessels', branch: 'tech', x: 1500, y: -90, requires: ['mechanisms'], cost: { copper_ingot: 8, gear: 4 }, time: 360, recipes: ['pipe', 'valve', 'water_pump', 'bathtub', 'fountain', 'boiler'] },
    { id: 'chemistry', name: 'Chemistry', description: 'Sulfur, rubber and black powder', branch: 'tech', x: 1500, y: -270, requires: ['glassworks'], cost: { glass: 6, charcoal: 10 }, time: 360, resources: ['sulfur'], recipes: ['black_powder', 'rubber', 'boots', 'umbrella', 'conveyor'] },
    { id: 'steam_power', name: 'Steam Power', description: 'Pistons, engines and powered workshops', branch: 'tech', x: 1650, y: -90, requires: ['plumbing'], cost: { boiler: 1, steel: 6 }, time: 480, recipes: ['piston', 'bearing', 'engine_block', 'steam_engine', 'lathe', 'crane', 'elevator'] },
    { id: 'oil_age', name: 'Oil Age', description: 'Crude oil, plastics and heavy drilling', branch: 'tech', x: 1800, y: -180, requires: ['steam_power', 'chemistry'], cost: { steel_plate: 4, engine_block: 1 }, time: 600, resources: ['crude_oil'], recipes: ['plastic', 'oil_pump', 'refinery', 'power_drill', 'drill_rig'] },
    { id: 'electricity', name: 'Electricity', description: 'Voltite, circuits and generators', branch: 'tech', x: 1950, y: -90, requires: ['oil_age'], cost: { copper_wire: 24, plastic: 8 }, time: 600, resources: ['voltite'], recipes: ['circuit', 'capacitor', 'voltite_cell', 'generator', 'arc_welder', 'arc_lamp'] },
    { id: 'automation', name: 'Automation', description: 'Assemblers and automatons', branch: 'tech', x: 2100, y: 0, requires: ['electricity'], cost: { circuit: 4, steel_plate: 8 }, time: 900, recipes: ['assembler', 'automaton_frame', 'automaton'] },

    // ---- Magic branch (left) ------------------------------------------------------
    { id: 'herbalism', name: 'Herbalism', description: 'Herbs, extracts and incense', branch: 'magic', x: -900, y: 0, requires: ['deep_roots'], cost: { water: 12, fiber: 8 }, time: 120, resources: ['herbs'], recipes: ['herbal_extract', 'spirit_water', 'incense'] },
    { id: 'sapcraft', name: 'Sapcraft', description: 'Resin tapping, glue and barkhide', branch: 'magic', x: -450, y: -270, requires: ['sap_flow'], cost: { wood: 20, water: 10 }, time: 120, resources: ['resin'], recipes: ['glue', 'barkhide', 'ritual_candle'] },
    { id: 'weaving', name: 'Weaving', description: 'Cloth and everything sewn from it', branch: 'magic', x: -900, y: 180, requires: ['moon_tides'], cost: { fiber: 20, rope: 4 }, time: 150, recipes: ['cloth', 'basket', 'garment', 'satchel', 'bed', 'toolbelt'] },
    { id: 'alchemy', name: 'Alchemy', description: 'Salt, wards and the first potions', branch: 'magic', x: -1050, y: -90, requires: ['herbalism'], cost: { herbal_extract: 4, water: 12 }, time: 180, resources: ['salt'], recipes: ['healing_potion', 'salt_ward'] },
    { id: 'ambercraft', name: 'Ambercraft', description: 'Amber pearls, charms and wands', branch: 'magic', x: -1050, y: 90, requires: ['herbalism'], cost: { resin: 8, fiber: 8 }, time: 180, resources: ['amber'], recipes: ['amber_pearl', 'charm', 'wand'] },
    { id: 'scrivenery', name: 'Scrivenery', description: 'Enchanted ink, scrolls and grimoires', branch: 'magic', x: -1200, y: 0, requires: ['alchemy', 'ambercraft'], cost: { paper: 8, amber_pearl: 2 }, time: 240, recipes: ['blank_scroll', 'enchanted_ink', 'scroll_of_growth', 'grimoire'] },
    { id: 'sporecraft', name: 'Sporecraft', description: 'Glowspores and living light', branch: 'magic', x: -1200, y: -180, requires: ['alchemy'], cost: { salt: 6, herbal_extract: 4 }, time: 240, resources: ['glowspore'], recipes: ['glow_paste', 'glow_potion', 'glow_lamp'] },
    { id: 'lunar_rites', name: 'Lunar Rites', description: 'Moon dew, moon silver and elixirs', branch: 'magic', x: -1200, y: 180, requires: ['ambercraft'], cost: { amber_pearl: 4, spirit_water: 6 }, time: 300, resources: ['moon_dew'], recipes: ['moon_elixir', 'moon_silver', 'moon_mirror', 'talisman'] },
    { id: 'crystal_attunement', name: 'Crystal Attunement', description: 'Mana crystals, dust and rune stones', branch: 'magic', x: -1350, y: 0, requires: ['scrivenery'], cost: { enchanted_ink: 4, moon_silver: 2 }, time: 360, resources: ['mana_crystal'], recipes: ['mana_dust', 'mana_potion', 'rune_stone', 'crystal_ball', 'rune_ring', 'staff'] },
    { id: 'high_rituals', name: 'High Rituals', description: 'Ritual kits, circles and totems', branch: 'magic', x: -1500, y: -90, requires: ['crystal_attunement', 'sporecraft'], cost: { rune_stone: 3, incense: 6 }, time: 480, recipes: ['ritual_kit', 'summoning_circle', 'warding_totem', 'spirit_lantern', 'philosophers_salt'] },
    { id: 'enchantment', name: 'Enchantment', description: 'Wearable magic and master arcana', branch: 'magic', x: -1500, y: 90, requires: ['crystal_attunement', 'lunar_rites'], cost: { mana_dust: 8, moon_silver: 3 }, time: 480, recipes: ['amulet', 'enchanted_cloak', 'seven_league_boots', 'spellbook', 'archmage_wand'] },
    { id: 'ley_mastery', name: 'Ley Mastery', description: 'Ley essence and the deepest magic', branch: 'magic', x: -1650, y: 0, requires: ['high_rituals', 'enchantment'], cost: { rune_stone: 6, mana_dust: 12 }, time: 900, resources: ['ley_essence'], recipes: ['ley_thread', 'ley_chart', 'dream_catcher', 'transmutation_stone', 'phylactery', 'wishing_lamp', 'potion_of_plenty'] },

    // ---- Magitech spine (center) — requires one node from EACH side ---------------
    { id: 'rune_engineering', name: 'Rune Engineering', description: 'Inscribed plates, conduits and lenses', branch: 'magitech', x: 0, y: -540, requires: ['spirit_pistons', 'ironworking', 'ambercraft'], cost: { iron_plate: 4, amber_pearl: 4 }, time: 300, recipes: ['rune_plate', 'mana_conduit', 'crystal_lens', 'stained_glass', 'vase'] },
    { id: 'voltite_arcana', name: 'Voltite Arcana', description: 'Storm rods, mana batteries, rune circuits', branch: 'magitech', x: 0, y: -720, requires: ['rune_engineering', 'electricity', 'high_rituals'], cost: { voltite_cell: 2, rune_stone: 4 }, time: 720, recipes: ['storm_rod', 'mana_battery', 'rune_circuit', 'scroll_of_storms'] },
    { id: 'aetherworks', name: 'Aetherworks', description: 'Skyships and aether navigation', branch: 'magitech', x: 0, y: -900, requires: ['voltite_arcana', 'ley_mastery'], cost: { ley_thread: 6, steel_plate: 8 }, time: 1200, recipes: ['skyship_balloon', 'skyship_hull', 'skyship', 'aether_compass'] },
    { id: 'golemcraft', name: 'Golemcraft', description: 'Golem cores and their bodies', branch: 'magitech', x: 0, y: 540, requires: ['arcane_engine', 'steelworks', 'crystal_attunement'], cost: { steel_plate: 4, rune_stone: 4 }, time: 600, recipes: ['golem_core', 'stone_golem', 'iron_golem'] },
    { id: 'arcane_machinery', name: 'Arcane Machinery', description: 'Arcane alloy and mana engines', branch: 'magitech', x: 0, y: 720, requires: ['golemcraft', 'steam_power'], cost: { engine_block: 1, mana_dust: 12 }, time: 720, recipes: ['arcane_alloy', 'mana_engine', 'clockwork_orrery', 'teleporter_frame'] },
    { id: 'thinking_machines', name: 'Thinking Machines', description: 'Engines that reason and guard', branch: 'magitech', x: 0, y: 900, requires: ['arcane_machinery', 'automation'], cost: { automaton: 1, rune_circuit: 2 }, time: 1200, recipes: ['thinking_engine', 'automaton_familiar', 'ward_turret', 'teleporter'] },
    { id: 'wonders_of_matter', name: 'Wonders of Matter', description: 'Monuments of steel and thought', branch: 'magitech', x: 0, y: 1080, requires: ['thinking_machines'], cost: { thinking_engine: 1, steel_plate: 16 }, time: 1800, recipes: ['mana_reactor', 'colossus', 'grand_clocktower', 'observatory', 'philosophers_engine'] },
    { id: 'wonders_of_spirit', name: 'Wonders of Spirit', description: 'Monuments of mana and moonlight', branch: 'magitech', x: 0, y: -1080, requires: ['aetherworks'], cost: { mana_battery: 4, transmutation_stone: 1 }, time: 1800, recipes: ['mana_well', 'world_tree_sapling', 'floating_gardens', 'leyline_nexus', 'aurora_beacon', 'arcane_citadel'] },
  ];

  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    description: n.description,
    cost: n.cost,
    researchTimeSeconds: n.time,
    requires: n.requires,
    effects: [
      ...(n.resources ?? []).map((id) => ({ kind: 'unlockResource', id }) as const),
      ...n.recipes.map((id) => ({ kind: 'unlockRecipe', id }) as const),
      // standard major bonus: tech majors boost crafting, magic majors boost
      // gathering, spine majors give +1% of each
      ...(n.branch === 'tech'
        ? [{ kind: 'craftEfficiency', percent: 2 } as const]
        : n.branch === 'magic'
          ? [{ kind: 'gatherEfficiency', resource: 'all', percent: 2 } as const]
          : [
              { kind: 'gatherEfficiency', resource: 'all', percent: 1 } as const,
              { kind: 'craftEfficiency', percent: 1 } as const,
            ]),
    ],
    branch: n.branch,
    x: n.x,
    y: n.y,
    major: true,
  }));
}

export const TECH_BY_ID: Record<string, TechNode> = Object.fromEntries(
  TECH.map((t) => [t.id, t]),
);
