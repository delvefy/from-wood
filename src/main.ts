import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import './app.css';
import App from './App.svelte';
import { initPurchases } from './lib/purchases';

// No-op in the Capacitor build (vite.config.ts disables the PWA plugin there).
registerSW({ immediate: true });

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

const app = mount(App, { target: document.getElementById('app')! });

export default app;
