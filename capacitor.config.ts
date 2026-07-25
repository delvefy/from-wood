import type { CapacitorConfig } from '@capacitor/cli';

// The native Android (later iOS) shell around the same Vite build the web
// version ships. appId is permanent on Google Play — never change it.
// Build with `npm run build:android` (sets CAP_BUILD so vite emits
// relative asset paths instead of the GitHub Pages /from-wood/ base).
const config: CapacitorConfig = {
  appId: 'victorblack.fromwood',
  appName: 'From Wood',
  webDir: 'dist',
};

export default config;
