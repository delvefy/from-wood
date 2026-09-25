import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { writable } from 'svelte/store';
import { supabase } from './supabase';

// Stale-build detection. The server publishes the current release
// (supabase/migrations/0016_app_release.sql); a build older than that shows a
// dismissible banner and nothing more. The game keeps working — an old client
// still talks to every RPC it knows about, so blocking play would punish
// players for a store rollout they do not control.
//
// The web build fixes itself: the service worker is registerType 'autoUpdate',
// so a reload picks up the new bundle. Only the native shell needs the store.

export const APP_VERSION = __APP_VERSION__;

// Used when the server row has no link for this platform yet.
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=victorblack.fromwood';

export interface UpdateInfo {
  latest: string;
  // Where the fix lives: a store page on native, null on web (reload instead).
  storeUrl: string | null;
}

export const updateAvailable = writable<UpdateInfo | null>(null);

// Dismissal lasts for this app session only: the player said "not now", not
// "never". A relaunch on a still-stale build asks again.
let dismissed = false;

export function dismissUpdatePrompt(): void {
  dismissed = true;
  updateAvailable.set(null);
}

// True when `a` is an older dotted version than `b`. Missing parts count as
// zero (0.2 === 0.2.0), and anything unparseable is treated as "not older" so
// a malformed server value can never nag every player at once.
export function isOlderVersion(a: string, b: string): boolean {
  const pa = a.split('.');
  const pb = b.split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number(pa[i] ?? 0);
    const y = Number(pb[i] ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x !== y) return x < y;
  }
  return false;
}

interface ReleaseRow {
  latest_version: string | null;
  android_url: string | null;
  ios_url: string | null;
}

function storeUrlFor(row: ReleaseRow): string | null {
  if (!Capacitor.isNativePlatform()) return null; // web: reload, no store trip
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return row.ios_url ?? null;
  return row.android_url ?? PLAY_STORE_URL;
}

export async function checkForUpdate(): Promise<void> {
  if (dismissed) return;
  try {
    const { data, error } = await supabase
      .from('app_release')
      .select('latest_version, android_url, ios_url')
      .maybeSingle();
    if (error || !data) return; // offline, or the table is not deployed yet
    const row = data as ReleaseRow;
    const latest = row.latest_version ?? '';
    if (!latest || !isOlderVersion(APP_VERSION, latest)) {
      updateAvailable.set(null);
      return;
    }
    updateAvailable.set({ latest, storeUrl: storeUrlFor(row) });
  } catch {
    // Never let a version check break startup.
  }
}

// Checked at launch and on every resume, so a player who leaves the app open
// for days still learns about a release without restarting.
export function initUpdateCheck(): void {
  void checkForUpdate();
  if (Capacitor.isNativePlatform()) {
    void CapacitorApp.addListener('resume', () => void checkForUpdate());
  } else {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    });
  }
}
