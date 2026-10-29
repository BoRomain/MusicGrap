import {defineConfig} from 'vite'
import {svelte} from '@sveltejs/vite-plugin-svelte'
import {fileURLToPath} from 'node:url'

// `vite build --mode android` swaps the Wails bindings for the Capacitor bridge.
export default defineConfig(({mode}) => ({
  plugins: [svelte()],
  resolve: {
    alias: {
      $backend: fileURLToPath(new URL(`./src/lib/backend/${mode === 'android' ? 'android' : 'wails'}.ts`, import.meta.url)),
    },
  },
}))
