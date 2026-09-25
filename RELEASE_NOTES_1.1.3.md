# From Wood 1.1.3 — Play Console

Version name `1.1.3` · version code `9` · AAB at
`android/app/build/outputs/bundle/release/app-release.aab`

## What's new (paste into Play Console → Release → Release notes, max 500 chars)

```
Weekly tournaments
• One tournament a week: opens Monday 12:00 UTC, runs until the following Monday.
• Scores are no longer capped, so the board shows your real net worth instead of bunching at the top.

Offline progress
• Time away now pays out for up to 24 hours, up from 8.
• Your village and your tournament run both keep earning while you're gone.
• A welcome-back screen shows what each one made.

Plus: a heads-up in-app when a new version is out.
```

## Shorter alternate (if you want it tighter)

```
• Tournaments are now weekly — one run, Monday to Monday.
• Tournament scores are no longer capped: the board shows your real net worth.
• Offline progress pays out for 24 hours instead of 8.
• Your village and your tournament run both earn while you're away, and a welcome-back screen shows what each made.
• The app now tells you when a new version is out.
```

## Before you roll out

1. Run `supabase/migrations/0015_drop_tournament_score_cap.sql` and
   `0016_app_release.sql` in the Supabase SQL editor. 0016 seeds
   `app_release.latest_version = '1.1.3'` — keep it equal to `package.json`'s
   `version` and to `android/app/build.gradle`'s `versionName` on every release,
   or the update banner will nag players on the newest build.
2. Upload the AAB, set the release notes above, roll out.

## Store listing is stale

`STORE_LISTING.md` still advertises **24-hour tournaments** in three places
(short description line 18, full description line 131, screenshot caption line
85) and "raced in a day" on line 46. The schedule is now one weekly run of
6.5 days. Suggested replacements:

- Short description: `Turn wood into Wonders. Idle crafting, 500-node tech tree, weekly tournaments.` (78 chars)
- Full description bullet: `• Weekly tournaments with permanent worker rewards`
- Screenshot caption: `Race the world in weekly tournaments`
- Line 46: `• Compete on a compact 98-node tournament tree built to be raced in a week`
