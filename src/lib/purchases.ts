import { Capacitor } from '@capacitor/core';
import {
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  Purchases,
} from '@revenuecat/purchases-capacitor';
import type { User } from '@supabase/supabase-js';
import { PREMIUM_BY_ID, PREMIUM_BY_PRODUCT } from '../content/premium';
import { getAccount, setPremiumCounts } from '../engine/account';
import type { PremiumId, PremiumItem } from '../engine/types';
import { supabase } from './supabase';

// Real-money purchases, in three layers:
//
//  1. RevenueCat SDK (native app only): wraps Google Play Billing (StoreKit
//     later), shows the store's purchase sheet, validates receipts. Its
//     identity is pinned to the Supabase user id, so purchases follow the
//     account across devices and reinstalls.
//  2. RevenueCat → revenuecat-webhook Edge Function → public.purchases ledger
//     (migration 0011). The webhook is the ONLY writer; grants and refunds
//     are ledger rows.
//  3. refreshPremium() (all platforms): aggregates the caller's ledger rows
//     and overwrites the account's premium counts — server truth, same
//     pattern as tournament reward workers. A purchase bought on the phone
//     shows up on the web version after sign-in, and console-forged or
//     refunded items vanish on the next refresh.
//
// Dev builds keep the free local grant (engine/premium.ts devGrantPremium);
// refreshPremium merges rather than overwrites there so those grants survive.

// RevenueCat *public* SDK key for the Google Play app (Project settings →
// API keys → Public app-specific API keys). Like the Supabase publishable
// key, it is safe to ship in the client. TODO: paste the real goog_ key.
const REVENUECAT_GOOGLE_API_KEY = 'goog_REPLACE_WITH_PUBLIC_SDK_KEY';

export const isNativeApp = Capacitor.isNativePlatform();

let configured = false;
let rcAppUserId: string | null = null;

// Purchase outcomes the UI distinguishes: 'pending' means the store charge
// succeeded but the webhook grant hadn't landed within the polling window —
// it will appear on a later refresh, the player just shouldn't retry-buy.
export type PurchaseOutcome = 'purchased' | 'pending' | 'cancelled';

export function initPurchases(): void {
  if (!isNativeApp) return;
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    // Deferred: supabase-js awaits this callback internally (see cloudSave).
    setTimeout(() => void syncRcIdentity(user), 0);
  });
}

async function ensureConfigured(): Promise<boolean> {
  if (!isNativeApp || REVENUECAT_GOOGLE_API_KEY.includes('REPLACE')) return false;
  if (!configured) {
    await Purchases.configure({ apiKey: REVENUECAT_GOOGLE_API_KEY });
    configured = true;
  }
  return true;
}

// Keep RevenueCat's app user id equal to the Supabase user id. Never logOut:
// signing out locally doesn't un-own the purchases, and the next sign-in
// re-points the identity anyway.
async function syncRcIdentity(user: User | null): Promise<void> {
  if (!user || user.is_anonymous) return;
  try {
    if (!(await ensureConfigured()) || rcAppUserId === user.id) return;
    await Purchases.logIn({ appUserID: user.id });
    rcAppUserId = user.id;
  } catch (err) {
    console.warn('purchases: RevenueCat identity sync failed', err);
  }
}

// Pull the signed-in player's purchases ledger and make it the account's
// premium counts. Called after every cloud-save payload apply (so the ledger
// always beats whatever the blob restored) and while polling after a
// purchase. Dev builds merge (free local grants survive); everywhere else
// the server aggregate simply wins.
export async function refreshPremium(): Promise<Record<PremiumId, number>> {
  const { data, error } = await supabase.from('purchases').select('product_id, delta');
  if (error) throw new Error(error.message);

  const counts: Record<PremiumId, number> = {};
  for (const row of data ?? []) {
    const item = PREMIUM_BY_PRODUCT[row.product_id as string];
    if (!item) continue;
    counts[item.id] = (counts[item.id] ?? 0) + (row.delta as number);
  }
  for (const [id, n] of Object.entries(counts)) {
    counts[id] = Math.min(Math.max(n, 0), PREMIUM_BY_ID[id]?.unique ? 1 : Infinity);
  }
  if (import.meta.env.DEV) {
    for (const [id, n] of Object.entries(getAccount().premium)) {
      counts[id] = Math.max(counts[id] ?? 0, n);
    }
  }
  setPremiumCounts(counts);
  return counts;
}

function isUserCancel(err: unknown): boolean {
  const e = err as { code?: unknown; userCancelled?: unknown } | null;
  return (
    !!e &&
    (e.userCancelled === true ||
      String(e.code) === String(PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR))
  );
}

function errorMessage(err: unknown, fallback: string): string {
  const message = (err as { message?: string } | null)?.message;
  return message || fallback;
}

// Buy `item` through the store. Requires the native app and an email-backed
// Supabase session (anonymous identities don't survive reinstalls, so real
// money must never hang off one). The store charge resolves first; ownership
// arrives when the webhook writes the ledger, so this polls refreshPremium
// until the count moves.
export async function purchasePremium(item: PremiumItem): Promise<PurchaseOutcome> {
  if (!isNativeApp) throw new Error('Purchases are only available in the Android app.');
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous) {
    throw new Error(
      'Sign in with an email account first (Settings → Account) — purchases are tied to your account.',
    );
  }
  if (!(await ensureConfigured())) {
    throw new Error('The store is not available right now. Please try again later.');
  }
  await syncRcIdentity(user);
  if (rcAppUserId !== user.id) throw new Error('Could not connect to the store. Try again.');

  const { products } = await Purchases.getProducts({
    productIdentifiers: [item.productId],
    type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  });
  const product = products[0];
  if (!product) throw new Error('This item is not available in the store right now.');

  const before = getAccount().premium[item.id] ?? 0;
  try {
    await Purchases.purchaseStoreProduct({ product });
  } catch (err) {
    if (isUserCancel(err)) return 'cancelled';
    throw new Error(errorMessage(err, 'Purchase failed.'));
  }

  // Charged. Wait up to ~30s for the RevenueCat → webhook → ledger hop.
  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(2000);
    try {
      const counts = await refreshPremium();
      if ((counts[item.id] ?? 0) > before) return 'purchased';
    } catch {
      // offline blip — keep polling
    }
  }
  return 'pending';
}

// Play keeps receipts on the Google account: after a reinstall under a fresh
// Supabase account this re-links them (RevenueCat emits a TRANSFER event and
// the webhook moves the ledger rows to the new user id).
export async function restoreNativePurchases(): Promise<void> {
  if (!isNativeApp) return;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous) {
    throw new Error('Sign in with an email account first (Settings → Account).');
  }
  if (!(await ensureConfigured())) {
    throw new Error('The store is not available right now. Please try again later.');
  }
  await syncRcIdentity(user);
  await Purchases.restorePurchases();
  // The TRANSFER webhook is quick but asynchronous; a couple of polls usually
  // catch it, and worst case the next app start refreshes again.
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(2000);
    try {
      await refreshPremium();
      break;
    } catch {
      // keep trying
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
