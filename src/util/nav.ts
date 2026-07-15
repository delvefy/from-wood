import { writable } from 'svelte/store';
import { RESOURCE_BY_ID } from '../content/resources';

export type Tab = 'gather' | 'craft' | 'research' | 'market' | 'tournament' | 'settings';

export const activeTab = writable<Tab>('gather');

// Which form the Settings → Account panel shows. Other views set this to
// 'register' before navigating to send the player straight to registration.
export const accountMode = writable<'signin' | 'register'>('signin');

// Per-view search text ('gather' | 'craft' | 'market'), session-only.
export const searchFilters = writable<Record<string, string>>({});

export function setSearch(view: string, text: string): void {
  searchFilters.update((s) => ({ ...s, [view]: text }));
}

// Jump to where a material comes from: gatherable → Gather, crafted → Craft,
// with that view's search filter pre-set to the material's name.
export function openMaterial(resourceId: string): void {
  const resource = RESOURCE_BY_ID[resourceId];
  if (!resource) return;
  const tab: Tab = resource.harvestAmount > 0 ? 'gather' : 'craft';
  setSearch(tab, resource.name);
  activeTab.set(tab);
}

// A tech node id another view asked the Research tree to center on (locked
// item hints). ResearchView consumes it and resets it to null.
export const focusTech = writable<string | null>(null);

export function openTech(techId: string): void {
  focusTech.set(techId);
  activeTab.set('research');
}
