# From Wood — Google Play store listing

Everything to paste into Play Console → Grow → Store presence → Main store listing,
plus the related App content answers. Char limits verified.

---

## App name (max 30 chars)

**`From Wood — Idle Crafting`** (25 chars)

The suffix adds the two highest-value search keywords ("idle", "crafting")
without looking spammy. Plain `From Wood` is the fallback if you prefer clean
branding.

## Short description (max 80 chars)

**`Turn wood into Wonders. Idle crafting, 500-node tech tree, 24h tournaments.`** (75 chars)

Alternate: `Start with a log. Craft 200+ recipes, research a huge tech tree, build Wonders.` (79)

## Full description (max 4000 chars — this one is ~2,300)

```
Everything starts with a single log.

From Wood is an idle crafting game about turning the simplest resource in the
world into a thriving village — and eventually, into Wonders. Send gatherers
into the forest, put crafters to work, and watch raw wood become planks,
planks become tools, and tools become things you never expected to build from
a tree.

⚒️ CRAFT YOUR WAY UP
• 200+ recipes arranged in a crafting pyramid: 10 raw resources feed 30
  materials, which feed 170 items
• Every recipe uses just two inputs — simple to learn, deep to optimize
• Production keeps running while you're away: come back to full stockpiles

🌳 A TECH TREE WORTH CLIMBING
• A 500-node research pyramid: begin at the base, follow magic up one side,
  technology up the other, and watch them fuse into magitech near the top
• Crown your village with Wonders at the apex
• Research is fast — the real strategy is gathering the materials to afford it

🏆 24-HOUR TOURNAMENTS
• Compete on a compact 98-node tournament tree built to be raced in a day
• Climb the leaderboard and earn permanent reward workers for your village
• Fair play enforced server-side — scores are verified, not trusted

🏘️ MANAGE YOUR VILLAGE
• Hire and assign gatherers and crafters; every worker counts
• Efficiency upgrades keep your economy compounding
• Finish the tree and Expand: a prestige system with 110 nodes of permanent
  bonuses funded by your Wonders

☁️ PLAY ANYWHERE
• Cloud saves: pick up on your phone where your browser left off
• No ads. Ever. Optional purchases only — managers and worker packs that
  speed things up, never gate content
• Works offline; your village doesn't stop when your connection does

From Wood is built for people who love watching numbers grow the honest way:
no energy timers, no forced ads, no paywalls. Just you, a forest, and the long
satisfying road from a pile of logs to a monument that touches the sky.

How far can you get... from wood?
```

## Graphic assets

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, ≤1 MB | ✅ have: `public/icons/icon-512.png` (verify it looks good at 48px) |
| Feature graphic | 1024×500 PNG/JPG, no alpha | ✅ `store-assets/feature-graphic.png` |
| Phone screenshots | 2–8, PNG/JPG, 16:9 or 9:16, min 1080px, ≤8 MB each | ✅ `store-assets/screenshots/` — 6 shots at 1080×1920. NOTE: tournament + leaderboard shots use staged standings with generated player names (WoodWizard etc.); market/gather shots show an injected mid-game save. Retake from a real device/save if you prefer. |
| 7" tablet screenshots | up to 8, same rules | Optional (needed for tablet quality badge) |
| 10" tablet screenshots | up to 8, min 1080px, 16:9/9:16 | Optional |
| Promo video | YouTube URL, public/unlisted, no ads on video | Optional — skip for launch |

### Screenshot shot list (order matters — first 3 do all the work)

1. **Village overview mid-game** — busy production, big numbers. Caption: "Turn a single log into a thriving village"
2. **Tech tree zoomed out** — the full pyramid silhouette. Caption: "Climb a 500-node research pyramid"
3. **Crafting screen** — recipe chain visible. Caption: "200+ recipes, endless optimization"
4. **Tournament leaderboard** — Caption: "Race the world in 24-hour tournaments"
5. **Workers screen** — Caption: "Hire gatherers and crafters that work while you sleep"
6. **Wonder / late-game** — Caption: "Build Wonders. Then Expand and do it all again, better"

Add captions as text overlays on the images (top third, big type) — Play strips
any metadata captions.

## Store settings (already decided)

- **Category:** Games → Simulation
- **Tags:** Idle, Crafting, Tycoon, City building, Strategy

## Contact details (Store listing → Contact details)

- Email: required, shown publicly — use a support alias, not a personal inbox
- Website: https://delvefy.github.io/from-wood/
- Privacy policy URL: host `public/privacy.html` → https://delvefy.github.io/from-wood/privacy.html

## App content answers (one-time, App content section)

- **Privacy policy:** URL above
- **Ads:** No, app does not contain ads
- **App access:** All functionality available without special access
  (anonymous play works — no login wall). If reviewers need an account for
  purchase testing, provide a demo email/password here.
- **Content rating (IARC questionnaire):** Category = Game. Violence/sex/
  language/drugs: No to all. Gambling: No. **Digital purchases: Yes.**
  **Users can interact / share (leaderboards): Yes — leaderboard names are
  user-visible.** Expected: Everyone / PEGI 3.
- **Target audience:** 13+ (do NOT include under-13 — avoids Families policy
  burden entirely)
- **News app:** No
- **COVID-19 tracing:** No
- **Data safety:** see conversation — email (optional), User IDs (shared with
  RevenueCat), purchase history, app interactions; encrypted in transit;
  deletable
- **Government app:** No
- **Financial features:** None
- **Health:** None

## Release notes for first production release (max 500 chars)

```
First release! Start with a single log and craft your way to Wonders:
• 200+ recipes and a 500-node tech tree
• Idle production — your village works while you're away
• 24-hour tournaments with permanent worker rewards
• Cloud saves across web and Android
• No ads, ever
```
