import type { MajorSpec } from './specs';

// The 48 majors of the authored tree (22 tech, 15 magic, 5 on the spirit
// spine, 6 on the matter spine; the root in core.ts is the 49th unlock node
// and the spirit spine's first). The layout is a big point-UP triangle
// (pyramid) on a strict 150px lattice — every major sits on a multiple of
// 150, arm rows run at y = -300 / -750 / -1200, and edges leave at clean
// angles (horizontal, vertical, 45°, or 2:1). The root (start) sits at the
// bottom-center of the base at (0, 0), the MAGIC arm runs left along the
// base row into the bottom-left corner (-3000), the TECH arm runs right into
// the bottom-right corner (+3600), and each arm's endgame climbs its slant
// edge in 45° steps (magic: crystal/high_rituals/ley; tech:
// oil/electricity/automation). Magitech is the center and the peak: two
// vertical spine columns (spirit x=-300, matter x=+300) climb from the base
// and converge to the apex, where the two wonders (end) sit at (±150,
// -4200). `requires` lists the previous major (or the root); where a
// PathSpec covers that edge the build step rewires the requirement through
// the path's small nodes. Spine majors also require one major from EACH side
// as direct long cross-links that sweep up through the triangle's interior.
//
// Keep connected majors ~300-700px apart (path chains need ~150px per small
// node), and don't let an edge pass within ~140px of an unrelated major.
// `npm run check-layout` (scripts/check-tech-layout.ts) verifies the grid,
// spacing and clearance rules — run it after moving any major.
//
// Balance: authored cost mixes and times only set the tree's SHAPE — index.ts
// rescales costs onto the per-mode value curve and bakes a flat 1-minute
// research time into every node. Authored times still matter: they fix how
// eras relate on the COST curve (30s at the root, 86400s on the final
// wonders).
// Costs lean on CRAFTED goods from earlier eras; `npm run validate` proves
// every cost is obtainable before the node that charges it.
export const MAJORS: MajorSpec[] = [
  // ---- Tech branch (right wedge, 22 majors) --------------------------------------
  // Woodworking sits close to the root (the magic twin is rope_making): it is
  // the game's first crafting unlock, kept within the first handful of nodes
  // so a new player immediately sees what to work toward. The early eras
  // march right along the base row; workshops stack on the rows above; the
  // oil/electric endgame climbs the slant toward the apex.
  { id: 'woodworking', name: 'Woodworking', description: 'Planks and paper', branch: 'tech', x: 450, y: -300, requires: ['basic_tools'], cost: { wood: 10, water: 4 }, time: 60, recipes: ['planks', 'paper'] },
  { id: 'quarrying', name: 'Quarrying', description: 'Stone and stone bricks', branch: 'tech', x: 900, y: -300, requires: ['woodworking'], cost: { wood: 12, water: 6 }, time: 150, resources: ['stone'], recipes: ['stone_brick'] },
  { id: 'metallurgy', name: 'Metallurgy', description: 'Copper + iron ore, copper ingots', branch: 'tech', x: 1350, y: -300, requires: ['quarrying'], cost: { stone: 15, wood: 20 }, time: 240, resources: ['copper_ore', 'iron_ore'], recipes: ['copper_ingot'] },
  { id: 'ironworking', name: 'Ironworking', description: 'Coal, iron smelting and basic metal stock', branch: 'tech', x: 1800, y: -300, requires: ['metallurgy'], cost: { copper_ingot: 12, stone_brick: 12 }, time: 600, resources: ['coal'], recipes: ['charcoal', 'iron_ingot', 'nails', 'iron_rod', 'iron_plate', 'copper_wire', 'gear', 'furnace', 'forge_bellows'] },
  { id: 'toolmaking', name: 'Toolmaking', description: 'Handles and the basic hand-tool set', branch: 'tech', x: 2250, y: -300, requires: ['ironworking'], cost: { iron_ingot: 12, plank: 24 }, time: 900, recipes: ['handle', 'hammer', 'saw', 'chisel', 'hatchet', 'pickaxe', 'shovel'] },
  { id: 'carpentry', name: 'Carpentry', description: 'Beams, frames and wooden furniture', branch: 'tech', x: 2700, y: -300, requires: ['toolmaking'], cost: { plank: 40, saw: 2 }, time: 1800, recipes: ['wooden_beam', 'wooden_frame', 'crate', 'bucket', 'table', 'chair', 'barrel'] },
  { id: 'claywork', name: 'Claywork', description: 'Clay pits, clay bricks, ceramics and the kiln', branch: 'tech', x: 1350, y: -750, requires: ['ironworking'], cost: { pickaxe: 2, water: 40 }, time: 1800, resources: ['clay'], recipes: ['brick', 'ceramic', 'pottery_dishes', 'kiln'] },
  { id: 'steelworks', name: 'Steelworks', description: 'Steel smelting and heavy metal stock', branch: 'tech', x: 1800, y: -750, requires: ['ironworking'], cost: { coal: 40, furnace: 1 }, time: 1800, recipes: ['steel', 'steel_plate', 'blade', 'spring', 'bolt_kit', 'chain', 'anvil', 'scythe', 'blast_furnace'] },
  { id: 'glassworks', name: 'Glassworks', description: 'Quartz sand, glass and optics', branch: 'tech', x: 900, y: -1200, requires: ['claywork'], cost: { brick: 30, kiln: 1 }, time: 3600, resources: ['quartz_sand'], recipes: ['glass', 'lens', 'glass_tube', 'window', 'mirror', 'spyglass', 'vial', 'lantern'] },
  { id: 'mechanisms', name: 'Mechanisms', description: 'Wheels, gearboxes and simple machines', branch: 'tech', x: 2250, y: -750, requires: ['steelworks', 'carpentry'], cost: { gear: 24, steel: 10 }, time: 3600, recipes: ['hinge', 'bracket', 'crank', 'pulley_block', 'wheel', 'axle_assembly', 'gearbox', 'sawmill', 'waterwheel', 'windmill', 'loom_machine'] },
  { id: 'construction', name: 'Construction', description: 'Pillars, arches and fitted interiors', branch: 'tech', x: 1800, y: -1200, requires: ['steelworks'], cost: { stone_brick: 60, wooden_beam: 10 }, time: 3600, recipes: ['stone_pillar', 'arch', 'door', 'cabinet', 'workbench', 'stove'] },
  { id: 'fine_machinery', name: 'Fine Machinery', description: 'Precision instruments and clockwork', branch: 'tech', x: 2700, y: -750, requires: ['mechanisms'], cost: { gearbox: 6, glass: 16 }, time: 7200, recipes: ['clock', 'music_box', 'printing_press', 'measuring_kit', 'hand_drill', 'wrench', 'magnifier'] },
  { id: 'plumbing', name: 'Plumbing', description: 'Pipes, valves and pressure vessels', branch: 'tech', x: 2700, y: -1200, requires: ['mechanisms'], cost: { copper_ingot: 30, gear: 12 }, time: 7200, recipes: ['pipe', 'valve', 'water_pump', 'bathtub', 'fountain', 'boiler'] },
  { id: 'chemistry', name: 'Chemistry', description: 'Sulfur, rubber and black powder', branch: 'tech', x: 900, y: -1650, requires: ['glassworks'], cost: { vial: 12, charcoal: 40 }, time: 7200, resources: ['sulfur'], recipes: ['black_powder', 'rubber', 'boots', 'umbrella', 'conveyor'] },
  { id: 'transport', name: 'Transport', description: 'Carts and boats', branch: 'tech', x: 3150, y: -300, requires: ['fine_machinery'], cost: { wheel: 12, barrel: 4 }, time: 10800, recipes: ['cart', 'wheelbarrow', 'rowboat', 'sailboat'] },
  { id: 'everyday_engineering', name: 'Everyday Engineering', description: 'Machines for the home and the street', branch: 'tech', x: 3150, y: -750, requires: ['fine_machinery'], cost: { gearbox: 6, clock: 2 }, time: 10800, recipes: ['bicycle', 'typewriter'] },
  { id: 'steam_power', name: 'Steam Power', description: 'Pistons, engines and powered workshops', branch: 'tech', x: 3150, y: -1200, requires: ['plumbing'], cost: { boiler: 3, valve: 8 }, time: 14400, recipes: ['piston', 'bearing', 'engine_block', 'steam_engine', 'lathe', 'crane', 'elevator'] },
  { id: 'railworks', name: 'Railworks', description: 'Rails and the iron horse', branch: 'tech', x: 3600, y: -300, requires: ['steam_power'], cost: { steel_plate: 16, steam_engine: 1 }, time: 21600, recipes: ['rail_track', 'locomotive'] },
  { id: 'oil_age', name: 'Oil Age', description: 'Crude oil, plastics and heavy drilling', branch: 'tech', x: 1350, y: -2100, requires: ['steam_power', 'chemistry'], cost: { engine_block: 3, black_powder: 12 }, time: 21600, resources: ['crude_oil'], recipes: ['plastic', 'oil_pump', 'refinery', 'power_drill', 'drill_rig'] },
  { id: 'electricity', name: 'Electricity', description: 'Voltite, circuits and generators', branch: 'tech', x: 1350, y: -2550, requires: ['oil_age'], cost: { plastic: 30, refinery: 1 }, time: 28800, resources: ['voltite'], recipes: ['circuit', 'capacitor', 'voltite_cell', 'generator', 'arc_welder', 'arc_lamp'] },
  { id: 'communications', name: 'Communications', description: 'Wires that talk and light that remembers', branch: 'tech', x: 1800, y: -2550, requires: ['electricity'], cost: { copper_wire: 120, circuit: 10 }, time: 43200, recipes: ['telegraph', 'camera'] },
  { id: 'automation', name: 'Automation', description: 'Assemblers and automatons', branch: 'tech', x: 900, y: -3000, requires: ['electricity'], cost: { circuit: 16, generator: 1 }, time: 43200, recipes: ['assembler', 'automaton_frame', 'automaton'] },

  // ---- Magic branch (left wedge, 15 majors) --------------------------------------
  // Fiber Binding mirrors woodworking on the magic side: the first extra
  // resource (fiber), kept just as close to the root. The base row runs left
  // to the corner; the arcane workshops stack above herbalism; the
  // crystal/ritual endgame climbs the slant at x = -1350.
  { id: 'rope_making', name: 'Fiber Binding', description: 'Fiber and rope', branch: 'magic', x: -450, y: -300, requires: ['basic_tools'], cost: { wood: 8, water: 8 }, time: 60, resources: ['fiber'], recipes: ['rope'] },
  { id: 'sapcraft', name: 'Sapcraft', description: 'Resin tapping, glue and barkhide', branch: 'magic', x: -900, y: -300, requires: ['rope_making'], cost: { wood: 60, fiber: 20 }, time: 600, resources: ['resin'], recipes: ['glue', 'barkhide', 'ritual_candle'] },
  { id: 'herbalism', name: 'Herbalism', description: 'Herbs, extracts and incense', branch: 'magic', x: -1350, y: -750, requires: ['rope_making'], cost: { water: 40, rope: 8 }, time: 600, resources: ['herbs'], recipes: ['herbal_extract', 'spirit_water', 'incense'] },
  { id: 'weaving', name: 'Weaving', description: 'Cloth and everything sewn from it', branch: 'magic', x: -900, y: -750, requires: ['rope_making'], cost: { fiber: 60, rope: 12 }, time: 900, recipes: ['cloth', 'basket', 'garment', 'satchel', 'bed', 'toolbelt'] },
  { id: 'alchemy', name: 'Alchemy', description: 'Salt, wards and the first potions', branch: 'magic', x: -1350, y: -1200, requires: ['herbalism'], cost: { herbal_extract: 12, spirit_water: 12 }, time: 1800, resources: ['salt'], recipes: ['healing_potion', 'salt_ward'] },
  { id: 'ambercraft', name: 'Ambercraft', description: 'Amber pearls, charms and wands', branch: 'magic', x: -1800, y: -750, requires: ['herbalism'], cost: { resin: 30, herbal_extract: 8 }, time: 1800, resources: ['amber'], recipes: ['amber_pearl', 'charm', 'wand'] },
  { id: 'scrivenery', name: 'Scrivenery', description: 'Enchanted ink, scrolls and grimoires', branch: 'magic', x: -1800, y: -1200, requires: ['alchemy', 'ambercraft'], cost: { paper: 24, amber_pearl: 6 }, time: 3600, recipes: ['blank_scroll', 'enchanted_ink', 'scroll_of_growth', 'grimoire'] },
  { id: 'sporecraft', name: 'Sporecraft', description: 'Glowspores and living light', branch: 'magic', x: -2550, y: -750, requires: ['alchemy'], cost: { salt: 20, incense: 12 }, time: 3600, resources: ['glowspore'], recipes: ['glow_paste', 'glow_potion', 'glow_lamp'] },
  { id: 'lunar_rites', name: 'Lunar Rites', description: 'Moon dew, moon silver and elixirs', branch: 'magic', x: -2250, y: -300, requires: ['ambercraft'], cost: { spirit_water: 16, charm: 4 }, time: 3600, resources: ['moon_dew'], recipes: ['moon_elixir', 'moon_silver', 'moon_mirror', 'talisman'] },
  { id: 'vitalism', name: 'Vitalism', description: 'Life coaxed into vials and vats', branch: 'magic', x: -3000, y: -300, requires: ['sporecraft'], cost: { glowspore: 24, glow_paste: 8 }, time: 7200, recipes: ['homunculus', 'vitae_flask'] },
  { id: 'divination', name: 'Divination', description: 'Cards, bowls and glimpses of tomorrow', branch: 'magic', x: -2700, y: -300, requires: ['lunar_rites'], cost: { moon_dew: 16, moon_elixir: 4 }, time: 7200, recipes: ['fortune_deck', 'singing_bowl'] },
  { id: 'crystal_attunement', name: 'Crystal Attunement', description: 'Mana crystals, dust and rune stones', branch: 'magic', x: -1350, y: -1650, requires: ['scrivenery'], cost: { enchanted_ink: 10, grimoire: 2 }, time: 7200, resources: ['mana_crystal'], recipes: ['mana_dust', 'mana_potion', 'rune_stone', 'crystal_ball', 'rune_ring', 'staff'] },
  { id: 'high_rituals', name: 'High Rituals', description: 'Ritual kits, circles and totems', branch: 'magic', x: -1350, y: -2100, requires: ['crystal_attunement', 'sporecraft'], cost: { rune_stone: 8, salt_ward: 4 }, time: 14400, recipes: ['ritual_kit', 'summoning_circle', 'warding_totem', 'spirit_lantern', 'philosophers_salt'] },
  { id: 'enchantment', name: 'Enchantment', description: 'Wearable magic and master arcana', branch: 'magic', x: -2250, y: -1650, requires: ['crystal_attunement', 'lunar_rites'], cost: { talisman: 3, rune_ring: 2 }, time: 14400, recipes: ['amulet', 'enchanted_cloak', 'seven_league_boots', 'spellbook', 'archmage_wand'] },
  { id: 'ley_mastery', name: 'Ley Mastery', description: 'Ley essence and the deepest magic', branch: 'magic', x: -1350, y: -2550, requires: ['high_rituals', 'enchantment'], cost: { mana_dust: 40, summoning_circle: 2 }, time: 28800, resources: ['ley_essence'], recipes: ['ley_thread', 'ley_chart', 'dream_catcher', 'transmutation_stone', 'phylactery', 'wishing_lamp', 'potion_of_plenty'] },

  // ---- Magitech spirit spine (center-left column x=-300, 5 majors) — one major from EACH side
  { id: 'spirit_pistons', name: 'Spirit Pistons', description: 'Gather +1%, craft output +1%', branch: 'magitech', x: -300, y: -750, requires: ['basic_tools', 'woodworking', 'rope_making'], cost: { wood: 20, rope: 4 }, time: 480, recipes: [] },
  { id: 'rune_engineering', name: 'Rune Engineering', description: 'Inscribed plates, conduits and lenses', branch: 'magitech', x: -300, y: -1500, requires: ['spirit_pistons', 'ironworking', 'ambercraft'], cost: { iron_plate: 10, amber_pearl: 8 }, time: 3600, recipes: ['rune_plate', 'mana_conduit', 'crystal_lens', 'stained_glass', 'vase'] },
  { id: 'voltite_arcana', name: 'Voltite Arcana', description: 'Storm rods, mana batteries, rune circuits', branch: 'magitech', x: -300, y: -3000, requires: ['rune_engineering', 'electricity', 'high_rituals'], cost: { voltite_cell: 4, rune_stone: 10 }, time: 21600, recipes: ['storm_rod', 'mana_battery', 'rune_circuit', 'scroll_of_storms'] },
  { id: 'aetherworks', name: 'Aetherworks', description: 'Skyships and aether navigation', branch: 'magitech', x: -300, y: -3600, requires: ['voltite_arcana', 'ley_mastery'], cost: { ley_thread: 12, steel_plate: 20 }, time: 43200, recipes: ['skyship_balloon', 'skyship_hull', 'skyship', 'aether_compass'] },
  { id: 'wonders_of_spirit', name: 'Wonders of Spirit', description: 'Monuments of mana and moonlight', branch: 'magitech', x: -150, y: -4200, requires: ['aetherworks'], cost: { mana_battery: 8, moon_mirror: 2 }, time: 86400, recipes: ['mana_well', 'world_tree_sapling', 'floating_gardens', 'leyline_nexus', 'aurora_beacon', 'arcane_citadel'] },

  // ---- Magitech matter spine (center-right column x=+300, 6 majors) -----------------------
  { id: 'arcane_engine', name: 'Arcane Engine', description: 'Gather +1%, craft output +1%', branch: 'magitech', x: 300, y: -750, requires: ['basic_tools', 'woodworking', 'rope_making'], cost: { plank: 12, rope: 6 }, time: 600, recipes: [] },
  { id: 'golemcraft', name: 'Golemcraft', description: 'Golem cores and their bodies', branch: 'magitech', x: 300, y: -1800, requires: ['arcane_engine', 'steelworks', 'crystal_attunement'], cost: { rune_stone: 8, anvil: 1 }, time: 7200, recipes: ['arcane_alloy', 'golem_core', 'stone_golem', 'iron_golem'] },
  { id: 'runic_industry', name: 'Runic Industry', description: 'Rune presses and enchanted workshops', branch: 'magitech', x: 300, y: -2400, requires: ['golemcraft', 'fine_machinery', 'scrivenery'], cost: { rune_plate: 4, printing_press: 1 }, time: 14400, recipes: ['rune_press', 'lightning_loom', 'levitation_disc'] },
  { id: 'arcane_machinery', name: 'Arcane Machinery', description: 'Arcane alloy and mana engines', branch: 'magitech', x: 300, y: -3000, requires: ['runic_industry', 'steam_power'], cost: { engine_block: 3, mana_dust: 30 }, time: 21600, recipes: ['mana_engine', 'clockwork_orrery', 'teleporter_frame'] },
  { id: 'thinking_machines', name: 'Thinking Machines', description: 'Engines that reason and guard', branch: 'magitech', x: 300, y: -3600, requires: ['arcane_machinery', 'automation'], cost: { automaton: 2, rune_circuit: 6 }, time: 43200, recipes: ['thinking_engine', 'automaton_familiar', 'ward_turret', 'teleporter'] },
  { id: 'wonders_of_matter', name: 'Wonders of Matter', description: 'Monuments of steel and thought', branch: 'magitech', x: 150, y: -4200, requires: ['thinking_machines'], cost: { thinking_engine: 1, locomotive: 1 }, time: 86400, recipes: ['mana_reactor', 'colossus', 'grand_clocktower', 'observatory', 'philosophers_engine'] },
];
