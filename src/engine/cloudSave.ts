import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { get } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import { refreshPremium } from '../lib/purchases';
import { supabase } from '../lib/supabase';
import { getAccount, replaceAccountData, type AccountData } from './account';
import { resetTickClock } from './actions';
import { gameMode, type GameMode } from './mode';
import {
  loadGame,
  restoreSlots,
  saveGame,
  snapshotSlots,
  withSavesSuspended,
  type SlotSnapshot,
} from './save';
import { createInitialState, game } from './state';
import {
  clearTournamentMeta,
  getTournamentMeta,
  setTournamentMeta,
  type TournamentMeta,
} from './tournamentMeta';

// Per-account cloud backup of the whole local state (both save slots, account
// data, tournament meta). The game stays local-first — IndexedDB/localStorage
// are the source of truth while playing — and Supabase holds one small jsonb
// row per email account (supabase/migrations/0004_cloud_saves.sql).
//
// Supabase traffic is deliberately tiny:
//   - upload: at most once per PUSH_INTERVAL_MS while playing (plus a flush
//     when the tab hides or the player signs out), skipped when nothing
//     changed since the last push;
//   - download: once per sign-in / app start; newer payload.savedAt wins.
// Anonymous identities never touch the table at all.
//
// Login vs signup (intent armed by the auth screen via setAuthIntent):
//   - login continues with the account's own progress — whatever was played
//     locally under another (usually anonymous) identity is discarded;
//   - signup keeps the local progress: it becomes the new account's save and
//     is pushed immediately so the cloud row exists from the start.
//
// Switching accounts on one device costs at most that single pull: the
// outgoing account's state is stashed in IndexedDB keyed by its user id, and
// restored from there if that account ever signs back in on this device.

interface CloudPayload {
  version: 1;
  savedAt: number; // client clock; cross-device conflicts are last-writer-wins
  mode: GameMode;
  slots: SlotSnapshot;
  account: AccountData;
  tournamentMeta: TournamentMeta | null;
}

// Which user id the local save currently belongs to (null until the device's
// first sign-in, which adopts whatever was played locally).
const OWNER_KEY = 'from-wood-owner-v1';
const stashKey = (uid: string) => `from-wood-stash-${uid}`;

// PLACEHOLDER cadence — tune against real Supabase usage once live.
const PUSH_INTERVAL_MS = 5 * 60_000; // steady-state backup while playing
const HIDE_PUSH_MIN_GAP_MS = 60_000; // extra flush when the tab hides

let currentUid: string | null = null;
let isEmailUser = false;
let lastPushAt = 0;
let lastPushedFingerprint = '';

// Auth events can interleave with each other and with pushes; run all cloud
// work strictly in order.
let queue: Promise<void> = Promise.resolve();

// What the player meant by the auth action they just took, armed by the auth
// screen right before the Supabase call and consumed by the first
// email-carrying auth event. Anonymous events never consume it, and a value
// left over from a failed attempt is cleared by the auth screen.
let pendingAuthIntent: 'signin' | 'signup' | null = null;

export function setAuthIntent(intent: 'signin' | 'signup' | null): void {
  pendingAuthIntent = intent;
}

export function initCloudSave(): void {
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    // Deferred: supabase-js awaits this callback internally, so issuing
    // Supabase requests inside it directly can deadlock.
    setTimeout(() => {
      queue = queue
        .then(() => handleAuthUser(user))
        .catch((err) => {
          // Forget the half-handled identity so the next auth event (or app
          // start) retries from scratch instead of pushing over stale state.
          currentUid = null;
          isEmailUser = false;
          console.warn('cloud save: auth change handling failed', err);
        });
    }, 0);
  });
}

async function handleAuthUser(user: User | null): Promise<void> {
  if (!user) {
    currentUid = null;
    isEmailUser = false;
    return;
  }
  const sameUser = user.id === currentUid;
  currentUid = user.id;
  isEmailUser = !user.is_anonymous;

  const intent = user.email ? pendingAuthIntent : null;
  if (user.email) pendingAuthIntent = null;

  if (intent === 'signup') {
    // Signup keeps the local progress: it becomes the new account's save.
    // (If signup required email confirmation there is no session here; the
    // later confirmed sign-in arrives as a plain login instead.)
    await finishSignup(user.id);
  } else if (sameUser) {
    return; // token refresh
  } else if (intent === 'signin') {
    // Login continues with the account's own progress. Only when the local
    // save already belongs to this account do the two copies race (another
    // device may have pushed); everything else is discarded.
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner === user.id) await adoptNewerCloudSave();
    else await switchToAccount(owner, user.id);
  } else {
    // No intent: app start restoring a session, or an anonymous sign-in.
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner === null) {
      // First identity this device sees: it adopts the existing local progress.
      localStorage.setItem(OWNER_KEY, user.id);
    }
    if (owner === null || owner === user.id) {
      await adoptNewerCloudSave();
    } else {
      await switchToAccount(owner, user.id);
    }
  }

  // Premium ownership is server truth (the purchases ledger): refresh AFTER
  // the payload apply so whatever premium counts the blob carried can never
  // outlive this sync. Best-effort — offline keeps the local bridge copy.
  if (isEmailUser) {
    try {
      await refreshPremium();
    } catch (err) {
      console.warn('cloud save: premium refresh failed', err);
    }
  }
}

// Same account as the local save: just check whether another device pushed a
// newer backup. One select per sign-in / app start; anonymous users skip it.
async function adoptNewerCloudSave(): Promise<void> {
  if (!isEmailUser) return;
  const cloud = await pullCloudSave();
  if (!cloud) return;
  const slots = await snapshotSlots();
  const localSavedAt = Math.max(slots.main?.lastSeen ?? 0, slots.tournament?.lastSeen ?? 0);
  // Last-writer-wins between devices; ties keep the local copy.
  if (cloud.savedAt <= localSavedAt) return;
  await withSavesSuspended(() => applyPayload(cloud));
}

// A different identity is taking this device over: the local progress is not
// theirs, so discard it — stashed under the outgoing owner (when there is
// one) so that account can pick it back up here — and continue with the
// incoming identity's own progress: the newer of its cloud backup and its
// local stash, or a fresh start when it has neither.
async function switchToAccount(oldUid: string | null, newUid: string): Promise<void> {
  await saveGame();
  await withSavesSuspended(async () => {
    if (oldUid) await idbSet(stashKey(oldUid), await buildPayload());
    const cloud = isEmailUser ? await pullCloudSave() : null;
    const stash = ((await idbGet(stashKey(newUid))) as CloudPayload | undefined) ?? null;
    const incoming = !cloud || (stash && stash.savedAt > cloud.savedAt) ? stash : cloud;
    localStorage.setItem(OWNER_KEY, newUid);
    await applyPayload(incoming);
    await idbDel(stashKey(newUid));
    lastPushAt = 0;
    lastPushedFingerprint = '';
  });
}

// Signup: whatever was played locally (usually anonymous progress) becomes
// the new account's progress, backed up right away so the cloud row exists
// from the start. The anonymous → email upgrade keeps its uid but the live
// JWT still carries is_anonymous=true — which the saves RLS rejects — so
// refresh the session before that first push.
async function finishSignup(uid: string): Promise<void> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) console.warn('cloud save: post-signup session refresh failed', error);
  if (data.session) isEmailUser = !data.session.user.is_anonymous;
  localStorage.setItem(OWNER_KEY, uid);
  lastPushAt = 0;
  lastPushedFingerprint = '';
  await pushNow();
}

// Make `payload` (or a fresh start when null) the live local state.
async function applyPayload(payload: CloudPayload | null): Promise<void> {
  await restoreSlots(payload?.slots ?? {});
  replaceAccountData(payload?.account ?? null);
  const meta = payload?.tournamentMeta ?? null;
  if (meta) setTournamentMeta(meta);
  else clearTournamentMeta();
  gameMode.set(payload?.mode ?? 'main');
  // loadGame leaves the store alone when the main slot is empty, so seed a
  // fresh state first — the previous account's state must never bleed through.
  game.set(createInitialState());
  await loadGame();
  resetTickClock();
}

async function buildPayload(): Promise<CloudPayload> {
  return {
    version: 1,
    savedAt: Date.now(),
    mode: get(gameMode),
    slots: await snapshotSlots(),
    account: getAccount(),
    tournamentMeta: getTournamentMeta(),
  };
}

async function pullCloudSave(): Promise<CloudPayload | null> {
  const { data, error } = await supabase.from('saves').select('payload').maybeSingle();
  if (error) throw new Error(error.message);
  const payload = data?.payload as CloudPayload | undefined;
  return payload && payload.version === 1 ? payload : null;
}

// Called from the autosave interval and on tab-hide; self-throttles so actual
// Supabase writes stay rare, and skips entirely when nothing changed.
export function maybeCloudPush(trigger: 'interval' | 'hide' = 'interval'): void {
  if (!currentUid || !isEmailUser) return;
  const minGap = trigger === 'hide' ? HIDE_PUSH_MIN_GAP_MS : PUSH_INTERVAL_MS;
  if (Date.now() - lastPushAt < minGap) return;
  queue = queue.then(pushNow).catch(() => {});
}

// After account deletion: make the device forget who owned the local save.
// Clears the in-memory identity immediately (so an already-queued push can't
// write on the deleted account's behalf), then drops the owner marker and its
// stash behind any in-flight cloud work.
export async function forgetCloudIdentity(): Promise<void> {
  currentUid = null;
  isEmailUser = false;
  lastPushAt = 0;
  lastPushedFingerprint = '';
  await (queue = queue
    .then(async () => {
      const owner = localStorage.getItem(OWNER_KEY);
      if (owner) await idbDel(stashKey(owner));
      localStorage.removeItem(OWNER_KEY);
    })
    .catch(() => {}));
}

// Immediate backup before signing out, so the account can pick its progress
// back up on the next sign-in (this device or another).
export async function flushCloudSave(): Promise<void> {
  if (!currentUid || !isEmailUser) return;
  await (queue = queue.then(pushNow).catch(() => {}));
}

async function pushNow(): Promise<void> {
  if (!currentUid || !isEmailUser) return;
  await saveGame();
  const payload = await buildPayload();
  // savedAt/lastSeen advance on every autosave even when idle; ignore them so
  // an untouched game never re-uploads.
  const fingerprint = JSON.stringify(payload, (key, value) =>
    key === 'savedAt' || key === 'lastSeen' ? 0 : (value as unknown),
  );
  // Stamp the attempt either way: a failed upsert (offline, cold Supabase)
  // retries on the next interval instead of every autosave tick.
  lastPushAt = Date.now();
  if (fingerprint === lastPushedFingerprint) return;
  const { error } = await supabase.from('saves').upsert({ user_id: currentUid, payload });
  if (error) {
    console.warn('cloud save: push failed', error.message);
    return;
  }
  lastPushedFingerprint = fingerprint;
}
