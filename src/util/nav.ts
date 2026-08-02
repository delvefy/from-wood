import { get, writable } from 'svelte/store';
import { RESOURCE_BY_ID } from '../content/resources';

export type Tab =
  | 'gather'
  | 'craft'
  | 'research'
  | 'market'
  | 'tournament'
  | 'settings'
  | 'leaderboard'
  | 'signin'
  | 'signup';

export const activeTab = writable<Tab>('gather');

// Sign-in and sign-up are full pages; this remembers where the player came
// from so finishing (or backing out of) the flow returns them there. Hopping
// between the two auth pages keeps the original return point.
const authReturnTab = writable<Tab>('settings');

export function openAuth(page: 'signin' | 'signup'): void {
  const current = get(activeTab);
  if (current !== 'signin' && current !== 'signup') authReturnTab.set(current);
  activeTab.set(page);
}

export function closeAuth(): void {
  activeTab.set(get(authReturnTab));
}

// Per-view search text ('gather' | 'craft' | 'market'), session-only.
export const searchFilters = writable<Record<string, string>>({});

// Trail of material-link jumps: each crumb is where the player stood before
// following a link, so the search box can offer a back button that retraces
// the chain (research node → recipe → its inputs → …). `tech` is set when the
// jump left the research tree, so back can re-center on that node.
export type NavCrumb = { tab: Tab; search: string; tech?: string };
export const navTrail = writable<NavCrumb[]>([]);

// Search never follows the player around: leaving a tab clears all filters.
// A manual tab switch also abandons the trail; `jumping` marks the switches
// made by link navigation, which keep it.
let lastTab: Tab = 'gather';
let jumping = false;
activeTab.subscribe((tab) => {
  if (tab === lastTab) return;
  lastTab = tab;
  searchFilters.set({});
  if (!jumping) navTrail.set([]);
});

function jumpTo(tab: Tab): void {
  jumping = true;
  activeTab.set(tab);
  jumping = false;
}

export function setSearch(view: string, text: string): void {
  searchFilters.update((s) => ({ ...s, [view]: text }));
}

// Jump to where a material comes from: gatherable → Gather, crafted → Craft,
// with that view's search filter pre-set to the material's name. The tab is
// switched first so the tab-change clear cannot wipe the preset filter.
export function openMaterial(resourceId: string, fromTech?: string): void {
  const resource = RESOURCE_BY_ID[resourceId];
  if (!resource) return;
  const tab: Tab = resource.harvestAmount > 0 ? 'gather' : 'craft';
  navTrail.update((t) => [
    ...t,
    { tab: lastTab, search: get(searchFilters)[lastTab] ?? '', tech: fromTech },
  ]);
  jumpTo(tab);
  setSearch(tab, resource.name);
}

// Pop the trail: return to the tab the last link was followed from, restoring
// its search text (or, for the research tree, re-centering on the node).
export function goBack(): void {
  const trail = get(navTrail);
  const crumb = trail[trail.length - 1];
  if (!crumb) return;
  navTrail.set(trail.slice(0, -1));
  jumpTo(crumb.tab);
  setSearch(crumb.tab, crumb.search);
  if (crumb.tech) focusTech.set(crumb.tech);
}

// A tech node id another view asked the Research tree to center on (locked
// item hints). ResearchView consumes it and resets it to null.
export const focusTech = writable<string | null>(null);

export function openTech(techId: string): void {
  focusTech.set(techId);
  activeTab.set('research');
}
