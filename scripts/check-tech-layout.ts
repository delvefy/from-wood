// Verifies the lattice layout rules that src/content/tech/majors.ts
// promises — run with `npm run check-layout` after moving any major or path:
// - every major (incl. the root) sits on the 150px grid
// - no two authored nodes land closer than a card's footprint (the authored
//   tree has no repulsion pass, so overlaps would render as-is in
//   tournaments)
// - no edge passes within ~140px of an unrelated major
// The village tree's generated fillers DO get a repulsion pass, so they are
// only sanity-checked with a looser floor (warn, not fail).
import { TECH_TREES } from '../src/content/tech';
import type { TechNode } from '../src/engine/types';

const GRID = 150;
const MIN_NODE_GAP = 132; // small cards render ~108px wide, majors ~132px
const MIN_EDGE_CLEARANCE = 138; // edge passing an unrelated major's card
const VILLAGE_WARN_GAP = 100; // post-repulsion floor for generated fillers

const failures: string[] = [];
const warnings: string[] = [];

function segmentPointDistance(
  ax: number, ay: number, bx: number, by: number, px: number, py: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

const authored = TECH_TREES.tournament;
const byId = new Map(authored.map((n) => [n.id, n]));

for (const n of authored) {
  if (n.major && (n.x % GRID !== 0 || n.y % GRID !== 0)) {
    failures.push(`off-grid major: ${n.id} at (${n.x}, ${n.y})`);
  }
}

for (let i = 0; i < authored.length; i++) {
  for (let j = i + 1; j < authored.length; j++) {
    const a = authored[i];
    const b = authored[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < MIN_NODE_GAP) {
      failures.push(`nodes too close (${Math.round(d)}px): ${a.id} <-> ${b.id}`);
    }
  }
}

for (const node of authored) {
  for (const from of node.requires) {
    const a = byId.get(from);
    if (!a) continue;
    for (const m of authored) {
      if (!m.major || m.id === node.id || m.id === a.id) continue;
      const d = segmentPointDistance(a.x, a.y, node.x, node.y, m.x, m.y);
      if (d < MIN_EDGE_CLEARANCE) {
        failures.push(
          `edge ${a.id} -> ${node.id} passes ${Math.round(d)}px from major ${m.id}`,
        );
      }
    }
  }
}

// Village fillers: repulsion should keep everything a card apart; surface
// anything it could not fully resolve so layout tweaks can widen the pinch.
const village = TECH_TREES.main;
const cell = new Map<string, TechNode[]>();
const key = (x: number, y: number) =>
  `${Math.floor(x / VILLAGE_WARN_GAP)},${Math.floor(y / VILLAGE_WARN_GAP)}`;
for (const n of village) {
  const k = key(n.x, n.y);
  (cell.get(k) ?? cell.set(k, []).get(k)!).push(n);
}
for (const n of village) {
  const cx = Math.floor(n.x / VILLAGE_WARN_GAP);
  const cy = Math.floor(n.y / VILLAGE_WARN_GAP);
  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (const m of cell.get(`${gx},${gy}`) ?? []) {
        if (m.id <= n.id) continue;
        const d = Math.hypot(n.x - m.x, n.y - m.y);
        if (d < VILLAGE_WARN_GAP) {
          warnings.push(`village nodes close (${Math.round(d)}px): ${n.id} <-> ${m.id}`);
        }
      }
    }
  }
}

for (const w of warnings) console.warn(`warn: ${w}`);
if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  console.error(`\n${failures.length} layout violation(s).`);
  process.exit(1);
}
console.log(
  `layout OK: ${authored.length} authored nodes on the lattice, ` +
    `${village.length} village nodes, ${warnings.length} warning(s).`,
);
