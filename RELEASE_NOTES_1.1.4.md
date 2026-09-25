# From Wood 1.1.4 — Play Console

Version name `1.1.4` · version code `10` · AAB at
`android/app/build/outputs/bundle/release/app-release.aab`

## What's new (paste into Play Console → Release → Release notes, max 500 chars)

```
Crafting pays off
• Crafted items now sell for much more, and deeper recipes pay more per crafter. Crafters are now your best earners in the late game.
• Research costs are unchanged.

Fixes
• Switching between your village and a tournament could submit the village's net worth as your tournament score. Fixed.
```

## Before you roll out

1. Migrations `0015`–`0017` must be applied (done). `0017` raises the
   score-predictor rate and village cap to match the new crafted prices.
2. Upload the AAB, set the release notes above, roll out.
3. Once the release is live on Play, bump the update-banner row:

   ```sql
   update public.app_release set latest_version = '1.1.4', updated_at = now();
   ```

   Do it after the rollout, not before, or 1.1.3 players get told to update
   to a version the store doesn't offer yet.
