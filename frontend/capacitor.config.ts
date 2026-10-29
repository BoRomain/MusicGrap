import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.borom.wave',
  appName: 'Wave',
  webDir: 'dist',
  android: {
    path: '../android',
    // Covers come from the Go core's HTTP server on 127.0.0.1 while the page is https://localhost.
    allowMixedContent: true,
  },
}

export default config
