# Run Guide

## Requirements
- Node.js 18+
- npm 9+

## Commands
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Scene Switching
- App boots to Main Menu.
- From menu:
  - `Start Merge Story` -> Merge board
  - `Match Mini Mode` -> match stub
  - `Dev Test Lab` -> debug tools

## AB Config
- Source: `src/systems/abtest/variants.default.json`
- Deterministic assignment persisted in localStorage.
- Reset keys to re-roll:
  - `dmt.ab.user`
  - `dmt.ab.variant.v1`

## Performance Profiling
- Toggle FPS overlay in runtime with key `F`.
- Use Chrome DevTools Performance recording during heavy merge loops.
- Validate particle count and frame pacing.

## Known Limitations
- Placeholder art/audio only.
- No real ad SDK / no backend economy sync.
- Match mini-mode is intentionally lightweight for MVP.
