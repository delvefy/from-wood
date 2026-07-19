import type { TechNode } from '../../engine/types';

// The hand-placed root of the 100-node tree. Everything else is generated
// from the compact specs in majors/paths. The root counts as the first node
// of the north magitech spine; the first-five pacing overrides in index.ts
// keep it (and the four branch openers) cheap and fast.
export const CORE: TechNode[] = [
  {
    id: 'basic_tools',
    name: 'Basic Tools',
    description: 'Gather +2%, craft output +2%',
    cost: { wood: 10, water: 10 },
    researchTimeSeconds: 30,
    requires: [],
    effects: [
      { kind: 'gatherEfficiency', resource: 'all', percent: 2 },
      { kind: 'craftEfficiency', percent: 2 },
    ],
    branch: 'magitech',
    x: 0,
    y: 0,
    major: true,
  },
];
