# Architecture Notes

## Core Separation

- **Simulation** (`src/game/GameSimulation.ts`): deterministic rules, state transitions, economy, progression, save-ready state.
- **Renderer** (`src/engine/CanvasRenderer.ts`): visual-only drawing (board, items, hud, effects).
- **UI Overlay** (`src/ui/OverlayUI.ts`): DOM controls and modals (orders, inbox, settings, debug).

## Runtime Pipeline

1. `GameLoop` ticks every frame
2. `GameSimulation.tick()` updates time-based systems
3. `CanvasRenderer.render()` draws current state
4. UI overlay receives state updates via subscription

## Input Flow

- Pointer input converted from screen space to virtual `1080x1920`
- Drag interactions resolve by simulation rules
- Invalid drops animate return in app layer
- Long hold -> tooltip, double tap -> mass merge

## State and Persistence

- Lightweight custom store (`src/services/Store.ts`)
- Full versioned save structure via `SaveService`
- Autosave every 30s + visibilitychange + beforeunload

## Extensibility

- New chains/orders/rooms/letters require JSON edits and localization entries
- Monetization and ads are interface stubs, ready for SDK adapter replacement
- Remote config supports rapid balance iteration without code edits
