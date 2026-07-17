# From Wood — Play Store Launch Plan

Goal: launch on Google Play first, App Store later. Monetization = the existing
premium shop (Market tab: managers + worker packs), sold as real in-app
purchases.

**Key constraint:** Google Play requires all real-money digital goods to go
through Google Play Billing (same for Apple/StoreKit later). The current
dev-mode "confirm dialog → free grant" in `src/engine/premium.ts` must be
replaced with real billing before launch.

**Chosen approach:** wrap the web build in **Capacitor** (native Android shell
around the Vite build) and use **RevenueCat** for purchases. RevenueCat is free
until ~$2.5k/month revenue, wraps both Play Billing and StoreKit behind one
API, and validates receipts for you — so the iOS launch later reuses almost
everything.

---

## Phase 0 — Finish pending backend work (prerequisite)

Purchases and premium items live on the Supabase account, so the account
system must be solid first.

- [ ] Apply pending Supabase migrations (email auth, cloud saves `0004`).
- [ ] Deploy the reset-password Edge Function + set the Resend API key.
- [ ] Verify sign-up → cloud save → premium grant round-trips on production
      Supabase.

## Phase 1 — Accounts & registrations

- [ ] Create a **Google Play Developer account** ($25 one-time) at
      https://play.google.com/console
  - **Decide: personal vs organization.** A new *personal* account must run a
    closed test with **12+ testers opted in for 14 continuous days** before
    Google lets you publish to production. An *organization* account skips
    this but needs a D-U-N-S number for your company.
  - If you have a company (epiceros?), the organization route is usually
    faster overall and looks better on the store listing.
- [ ] Create a **RevenueCat** account (free tier) at https://www.revenuecat.com
- [ ] Do **not** create the Apple Developer account yet ($99/year — start the
      clock only when iOS work begins).

## Phase 2 — Wrap the game in Capacitor

- [ ] `npm i @capacitor/core @capacitor/android && npm i -D @capacitor/cli`
- [ ] `npx cap init "From Wood" com.yourdomain.fromwood --web-dir=dist`
      (pick the app ID carefully — **it can never be changed** on Play)
- [ ] `npx cap add android`, then `npm run build && npx cap sync` becomes the
      build loop.
- [ ] Install Android Studio; verify the game runs on an emulator and a real
      phone (touch targets, safe areas/notch, back button behavior).
- [ ] Generate a **signed release keystore** and back it up somewhere safe —
      losing it means losing the app. Enroll in Play App Signing (default).
- [ ] Keep the PWA build working — nothing about Capacitor breaks the web
      version.

## Phase 3 — Real purchases (RevenueCat + Play Billing)

- [ ] In Play Console, create the in-app products matching
      `src/content/premium.ts`:
  - `gatherManager`, `craftManager`, `marketManager` → **non-consumable**
    (one-time) products
  - `gathererPack`, `crafterPack` → **consumable** (repeatable) products
- [ ] Sanity-check pricing: $50 for a manager is very high for an idle game —
      the file itself says prices are placeholders. Decide real prices now;
      changing them later is easy, but first impressions matter.
- [ ] Connect the Play Console app to RevenueCat, mirror the products there.
- [ ] `npm i @revenuecat/purchases-capacitor`
- [ ] Replace the free grant in `buyPremium()` (`src/engine/premium.ts`) with:
      purchase via RevenueCat → on success, grant the item on the account
      (existing code path) → cloud save sync persists it.
  - Keep the current free-grant path behind a dev flag for local/web testing.
- [ ] Identify the RevenueCat user with the Supabase user ID so purchases
      survive reinstalls and follow the account.
- [ ] (Later hardening, not launch-blocking) RevenueCat webhook → Supabase
      Edge Function to grant entitlements server-side instead of trusting the
      client.
- [ ] Test with **License Testing** accounts in Play Console (test cards, no
      real charges).

## Phase 4 — Play Store compliance & listing

- [ ] **Privacy policy** — required (you collect emails via Supabase auth).
      A simple hosted page is fine; generators exist. Link it in Play Console
      and inside the app.
- [ ] **Account deletion** — Google requires apps with account creation to
      offer in-app account deletion *and* a web URL for deletion requests.
      Add a "Delete account" button (Supabase: delete user + their saves).
- [ ] Fill the **Data safety** form (declares: email, gameplay data, no ads).
- [ ] Fill the **content rating** questionnaire (IARC) — an idle crafting game
      with IAP will land at Everyone/PEGI 3, but you must declare the IAP.
- [ ] Store assets:
  - App icon 512×512
  - Feature graphic 1024×500
  - 4–8 phone screenshots (and 7"/10" tablet if you want tablet distribution)
  - Short description (80 chars) + full description (4000 chars)
- [ ] Check target API level requirement in Play Console (Google raises it
      yearly; recent Capacitor versions track it).

## Phase 5 — Testing tracks → production

- [ ] Upload a signed **AAB** (not APK) to a **closed testing** track.
- [ ] If on a personal account: recruit 12+ testers (friends/Discord/Reddit
      playtest groups), keep them opted in for 14 days, then apply for
      production access.
- [ ] Use the testing window to watch: crash reports (Play Console vitals),
      purchase flow end-to-end with a test card, cloud save sync across
      devices.
- [ ] Promote to **production** (optionally staged rollout at 20% → 100%).

## Phase 6 — App Store (later)

- [ ] Apple Developer account ($99/year, D-U-N-S needed for org).
- [ ] `npx cap add ios` — same web build, same RevenueCat code; create the
      matching IAP products in App Store Connect and mirror in RevenueCat.
- [ ] Apple-specific requirements: "Sign in with Apple" is **mandatory**
      because you offer email/password login; account deletion in-app;
      App Tracking Transparency not needed (no ads/tracking).
- [ ] App Review is stricter than Google's — budget a rejection round-trip.

---

## Open decisions

| Decision | Options | Leaning |
| --- | --- | --- |
| Play account type | Personal (12 testers × 14 days) vs Organization (D-U-N-S) | Organization if you have a registered company |
| App ID | `com.<yourdomain>.fromwood` — permanent | Decide before `cap init` |
| Real prices | Current $50/$5 are placeholders | Rethink the $50 tier |
| Server-side entitlements | Trust client at launch vs webhook Edge Function | Client at launch, webhook soon after |

## Rough effort estimate

- Phase 0–2: ~2–4 days (mostly Capacitor setup + device testing)
- Phase 3: ~2–3 days (billing integration + testing)
- Phase 4: ~1–2 days (paperwork + assets)
- Phase 5: **14+ calendar days** if personal account (the tester clock is the
  long pole — start it early, keep polishing during it)
