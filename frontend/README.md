# Frontend

React 18 + TypeScript + Vite. UI components come from `@romain/uilib`
(linked from `../../UiLib`; build it there first with `npm install && npm run build`).
Global state lives in a Zustand store (`src/lib/store.ts`).

- `npm run dev`: Vite dev server (used by `wails dev`)
- `npm run build`: desktop build (Wails bindings)
- `npm run build:android`: Android build (Capacitor bridge, `src/lib/backend/android.ts`)
- `npm run check`: type check
