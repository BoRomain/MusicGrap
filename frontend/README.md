# Frontend

React 18 + TypeScript + Vite. UI components live in `src/uilib` (copied from UiLib:
only the components the app uses, no external dependency).
Global state lives in a Zustand store (`src/lib/store.ts`).

- `npm run dev`: Vite dev server (used by `wails dev`)
- `npm run build`: desktop build (Wails bindings)
- `npm run build:android`: Android build (Capacitor bridge, `src/lib/backend/android.ts`)
- `npm run check`: type check
