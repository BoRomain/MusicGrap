import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'

// `vite build --mode android` swaps the Wails bindings for the Capacitor bridge.
export default defineConfig(({mode}) => ({
  plugins: [react()],
  resolve: {
    // @romain/uilib is linked from ../../UiLib: keep a single copy of React.
    dedupe: ['react', 'react-dom'],
    alias: {
      $backend: fileURLToPath(new URL(`./src/lib/backend/${mode === 'android' ? 'android' : 'wails'}.ts`, import.meta.url)),
    },
  },
}))
