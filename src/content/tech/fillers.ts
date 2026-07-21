import type { TechBranch } from '../../engine/types';

// Name pools for the generated village-only filler smalls. The village tree
// splices ~900 of these into the edges of the authored 100-node tree, so each
// branch needs a deep pool of unique names: 24 adjectives x 24 nouns = 576
// combinations per branch, assigned sequentially (adjective cycles fastest).
// Word choices deliberately avoid recreating any authored small-node name
// (e.g. no Verdant+Whisper), since slugs must stay unique tree-wide —
// `npm run validate` enforces that.
const POOLS: Record<TechBranch, { adjectives: string[]; nouns: string[] }> = {
  magic: {
    adjectives: [
      'Silvered', 'Moonlit', 'Hallowed', 'Fey', 'Sylvan', 'Runeswept',
      'Emberlit', 'Dusken', 'Starbound', 'Veiled', 'Blooming', 'Whistling',
      'Glimmering', 'Hollow', 'Elder', 'Twilight', 'Dewkissed', 'Wandering',
      'Thorned', 'Mistborn', 'Sacred', 'Umbral', 'Radiant', 'Murmuring',
    ],
    nouns: [
      'Charms', 'Sigils', 'Omens', 'Blessings', 'Glyphs', 'Wisps',
      'Circles', 'Brews', 'Tinctures', 'Cantrips', 'Fetishes', 'Auguries',
      'Censers', 'Petals', 'Groves', 'Reveries', 'Hexes', 'Litanies',
      'Talismans', 'Offerings', 'Seances', 'Phials', 'Runework', 'Wardings',
    ],
  },
  tech: {
    adjectives: [
      'Tempered', 'Milled', 'Riveted', 'Calibrated', 'Forged', 'Beveled',
      'Geared', 'Bolted', 'Polished', 'Reinforced', 'Machined', 'Cast',
      'Welded', 'Balanced', 'Hardened', 'Threaded', 'Pressed', 'Turned',
      'Braced', 'Ground', 'Soldered', 'Stamped', 'Jointed', 'Tuned',
    ],
    nouns: [
      'Fittings', 'Gauges', 'Ratchets', 'Levers', 'Couplings', 'Flanges',
      'Sprockets', 'Bearings', 'Clamps', 'Spindles', 'Rivets', 'Pistons',
      'Linkages', 'Tolerances', 'Blueprints', 'Lathework', 'Camshafts',
      'Pinions', 'Manifolds', 'Templates', 'Calipers', 'Gantries',
      'Workflows', 'Assemblies',
    ],
  },
  // Magitech takes the lion's share of fillers — every cross-link edge from
  // the arms to the spine is long and carries the child's (magitech) branch —
  // so its pool is deeper than the other two: 32 x 30 = 960 combinations.
  magitech: {
    adjectives: [
      'Enchanted', 'Runic', 'Arcane', 'Attuned', 'Sparkbound', 'Hexwired',
      'Sigiled', 'Manaforged', 'Etheric', 'Charged', 'Warded', 'Resonant',
      'Spellwrought', 'Voltaic', 'Inscribed', 'Animated', 'Leybound',
      'Glowforged', 'Thaumic', 'Astral', 'Empowered', 'Conjured',
      'Galvanic', 'Transmuted', 'Bespelled', 'Ensorcelled', 'Fluxbound',
      'Gildwired', 'Hallowired', 'Ironsung', 'Manalit', 'Runefused',
    ],
    nouns: [
      'Conduits', 'Regulators', 'Dynamos', 'Actuators', 'Matrices',
      'Resonators', 'Servos', 'Capacitors', 'Turbines', 'Armatures',
      'Inductors', 'Chassis', 'Relays', 'Oscillators', 'Golemry',
      'Alembics', 'Converters', 'Stabilizers', 'Injectors', 'Amplifiers',
      'Governors', 'Accumulators', 'Rotors', 'Engravings', 'Ballasts',
      'Cogwheels', 'Solenoids', 'Reactors', 'Transducers', 'Windings',
    ],
  },
};

// Hands out the i-th filler name of a branch; unique for i < 576 per branch.
export function fillerName(branch: TechBranch, i: number): string {
  const { adjectives, nouns } = POOLS[branch];
  if (i >= adjectives.length * nouns.length) {
    throw new Error(`filler name pool exhausted for ${branch} (${i})`);
  }
  return `${adjectives[i % adjectives.length]} ${nouns[Math.floor(i / adjectives.length)]}`;
}
