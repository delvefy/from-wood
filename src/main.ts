import './app.css';

// The web version is retired: only the store apps run the game. A production
// web build renders a pointer to the store instead of booting, and ships a
// self-destroying service worker (vite.config.ts) so installed PWAs drop their
// cached copy of the game. `npm run dev` still boots the game in the browser.
// Both flags are build-time constants, so the web bundle leaves the game out.
if (__NATIVE_BUILD__ || import.meta.env.DEV) {
  void import('./boot');
} else {
  document.getElementById('app')!.innerHTML = `
    <div class="retired">
      <h1>From Wood is now an app</h1>
      <p>The web version has closed. Play on Android:</p>
      <p><a href="https://play.google.com/store/apps/details?id=victorblack.fromwood">Get it on Google Play</a></p>
      <p class="muted">Registered players: sign in inside the app to continue your progress.</p>
    </div>`;
}
