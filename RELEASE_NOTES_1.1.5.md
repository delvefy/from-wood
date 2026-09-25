# From Wood 1.1.5 — Play Console

Version name `1.1.5` · version code `11` · AAB at
`android/app/build/outputs/bundle/release/app-release.aab`

## What's new (paste into Play Console → Release → Release notes, max 500 chars)

```
Fair play
• Time away is now measured by the server. Changing your phone's clock no longer earns offline progress.
• Offline progress is still paid for up to 24 hours. If you open the game without a connection, your time away is paid as soon as you're back online.
```

## Before you roll out

1. Migration `0018` must be applied first. It adds `sync_clock` and drops the
   score ledger. Without it, 1.1.5 pays no offline progress and its scores
   don't save.
2. Upload the AAB, set the release notes above, roll out.
3. Once the release is live on Play, bump the update-banner row:

   ```sql
   update public.app_release set latest_version = '1.1.5', updated_at = now();
   ```

   Do it after the rollout, not before, or 1.1.4 players get told to update
   to a version the store doesn't offer yet.
