import type { CapacitorConfig } from '@capacitor/cli'

// CAP_LIVE=1 (set by scripts/android-live.ps1) points the WebView at the Vite dev server,
// reached through `adb reverse`, so UI edits show up on the phone without reinstalling.
const live = process.env.CAP_LIVE === '1'

const config: CapacitorConfig = {
  // 127.0.0.1, not localhost: network_security_config.xml only allows cleartext to the loopback IP.
  ...(live && { server: { url: 'http://127.0.0.1:5173', cleartext: true } }),
  appId: 'com.borom.wave',
  appName: 'Wave',
  webDir: 'dist',
  // The bridge would otherwise log every call and event (4 progress events a second).
  loggingBehavior: 'none',
  android: {
    path: '../android',
    // Covers come from the Go core's HTTP server on 127.0.0.1 while the page is https://localhost.
    allowMixedContent: true,
  },
}

export default config
