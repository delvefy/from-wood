// The game itself: loaded by main.ts in the native shell and in `npm run dev`.
import { mount } from 'svelte';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import App from './App.svelte';
import { initTournamentReminders } from './lib/notifications';
import { initPurchases } from './lib/purchases';

if (Capacitor.isNativePlatform()) {
  // The game is a single-page tab UI with no webview history, so Android's
  // back button minimizes the app (the platform-expected behavior) instead of
  // doing nothing — a common Play review complaint against webview apps.
  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) history.back();
    else void CapacitorApp.minimizeApp();
  });
}

// Native only (no-op on web): RevenueCat SDK setup + keeping its identity
// pinned to the Supabase user id.
initPurchases();

// Native only (no-op on web): re-arm the local tournament-start reminders.
initTournamentReminders();

mount(App, { target: document.getElementById('app')! });
