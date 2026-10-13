import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor packaging for Android/iOS. The native projects are NOT generated or
 * built in this repository yet — see docs/CAPACITOR.md for the exact steps.
 * Replace appId with the final reverse-domain identifier before publishing.
 */
const config: CapacitorConfig = {
  appId: 'dz.as3ari.app',
  appName: 'As3ari',
  webDir: 'dist',
  server: {
    // Native WebView serves the bundled app over https://localhost (Android) — no remote code loading.
    androidScheme: 'https',
  },
};

export default config;
