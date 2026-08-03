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

- [x] Capacitor installed; app ID **`victorblack.fromwood`** (permanent),
      config in `capacitor.config.ts`, android platform committed.
- [x] Build loop: `npm run build:android` (CAP_BUILD=1 vite build + cap sync —
      relative asset base, PWA/service worker disabled in the native shell).
- [x] Android back button minimizes the app (`src/main.ts`).
- [ ] Install Android Studio; verify the game runs on an emulator and a real
      phone (touch targets, safe areas/notch, back button behavior).
      Open the project with `npx cap open android`.
- [x] Generate a **signed release keystore** — done: `~/keystores/from-wood-release.keystore`
      (alias `fromwood`; secrets in gitignored `android/keystore.properties`).
      Backed up. Enroll in Play App Signing on first upload (accept the default).
      Signed AAB build: `cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease`
      → `android/app/build/outputs/bundle/release/app-release.aab`.
- [x] PWA/web build untouched (plain `npm run build` as before).

## Phase 3 — Real purchases (RevenueCat + Play Billing)

Code is DONE and server-authoritative from day one:

- `src/lib/purchases.ts` — RevenueCat SDK: identity pinned to the Supabase
  user id, purchase flow, restore-purchases, ledger polling.
- `supabase/migrations/0011_premium_purchases.sql` — RLS-locked purchases
  ledger; clients read their own rows, only the webhook writes.
- `supabase/functions/revenuecat-webhook` — verifies a shared secret, grants
  on purchase, revokes on refund, re-grants on refund-reversal, re-homes
  rows on TRANSFER (reinstall restore), idempotent on retries.
- Client treats ledger aggregates as truth (`refreshPremium`), same pattern
  as tournament reward workers; dev builds keep a free local grant
  (`devGrantPremium`); the public web build shows the catalog read-only and
  purchases made in the app apply there after sign-in.
- Buying requires an email-backed sign-in (never hang money off an anonymous
  identity); purchases survive hard reset.

Remaining setup (dashboards, in this order):

- [x] Apply migration 0011 (`supabase db push`) — done.
- [x] Deploy the webhook: `supabase functions deploy revenuecat-webhook` — done.
- [x] Generate a long random secret; set it both sides — done, verified
      (RevenueCat test event → 200):
      `supabase secrets set RC_WEBHOOK_SECRET=<value>` and in RevenueCat →
      Integrations → Webhooks (Authorization header value must be identical).
      Webhook URL: `https://mawhmuprhprzmdgjzqve.supabase.co/functions/v1/revenuecat-webhook`
- [x] In Play Console, create the 4 in-app products (ids must match
      `src/content/premium.ts` exactly):
  - `gather_manager`, `craft_manager`, `market_manager` → one-time,
    **non-consumable** ($49.99)
  - `worker_pack` → one-time, **consumable** ($9.99)
- [x] In RevenueCat: create the project + Play Store app, connect the Play
      service credentials, add the same 4 products (mark `worker_pack`
      consumable so it can be re-bought) — done.
- [x] Paste the RevenueCat **public Google SDK key** (goog_…) into
      `REVENUECAT_GOOGLE_API_KEY` in `src/lib/purchases.ts` (safe to commit,
      like the Supabase publishable key).
- [ ] Test with **License Testing** accounts in Play Console (test cards, no
      real charges): buy each product, check the row lands in `purchases`,
      refund from Play Console and confirm the item is revoked on next sync.

## Phase 4 — Play Store compliance & listing

- [ ] **Privacy policy** — required (you collect emails via Supabase auth).
      A simple hosted page is fine; generators exist. Link it in Play Console
      and inside the app.
- [x] **Account deletion** — Google requires apps with account creation to
      offer in-app account deletion *and* a web URL for deletion requests.
      Done: Settings → Account → Danger zone (password-confirmed; the
      delete-account Edge Function removes the auth user and everything
      cascades). The live web app's Settings tab doubles as the web URL.
      Remember to `supabase functions deploy delete-account`.
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

- [x] Upload a signed **AAB** (not APK) to a **closed testing** track.
      ⚠️ The first upload (versionCode 1) was built *before* the RevenueCat
      key was pasted in — purchases are dead in it. Upload the rebuilt
      versionCode 2 AAB (2026-08-03) and roll it out before testing billing.
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

| Decision | Outcome |
| --- | --- |
| Play account type | **Personal** — plan for the 12-testers × 14-days closed test |
| App ID | **`victorblack.fromwood`** (baked in, permanent) |
| Real prices | **Keeping** $49.99 managers / $9.99 worker pack |
| Server-side entitlements | **Webhook from day one** (purchases ledger, migration 0011) |

## Rough effort estimate

- Phase 0–2: ~2–4 days (mostly Capacitor setup + device testing)
- Phase 3: ~2–3 days (billing integration + testing)
- Phase 4: ~1–2 days (paperwork + assets)
- Phase 5: **14+ calendar days** if personal account (the tester clock is the
  long pole — start it early, keep polishing during it)
