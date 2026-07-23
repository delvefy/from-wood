import type { TechNode } from '../../engine/types';

// The hand-placed root of the tree — the bottom vertex of the triangle.
// Everything else is generated from the compact specs in majors/paths. The
// root counts as the first node of the magitech spirit spine. Its authored
// time/cost only seed the cost curve; like every node it researches in the
// flat minute baked by index.ts.
export const CORE: TechNode[] = [
  {
    id: 'basic_tools',
    name: 'Basic Tools',
    description: 'Gather +1%, craft output +1%',
    cost: { wood: 10, water: 10 },
    researchTimeSeconds: 30,
    requires: [],
    effects: [
      { kind: 'gatherEfficiency', resource: 'all', percent: 1 },
      { kind: 'craftEfficiency', percent: 1 },
    ],
    branch: 'magitech',
    x: 0,
    y: 0,
    major: true,
  },
];
