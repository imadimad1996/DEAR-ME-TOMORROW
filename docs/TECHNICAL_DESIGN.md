# Technical Design

## Stack
- TypeScript + Vite + PixiJS 7
- Mobile-first canvas renderer (WebGL/canvas fallback)
- PWA manifest + service worker

## Runtime Architecture
- `engine/Game.ts`: app bootstrap, scene registration, resize, ticker.
- `engine/SceneManager.ts`: scene switching lifecycle.
- `engine/Tween.ts`: lightweight tween manager.
- `engine/VFXPool.ts`: pooled particle burst system.
- `systems/*`: gameplay domains (merge/orders/energy/echo/boosters/narrative/ads/analytics/abtest).

## Scene Layout
- `MainMenuScene`
- `MergeBoardScene`
- `RoomViewEntranceHallScene`
- `MatchMiniModeScene`
- `DevTestScene`

## Persistence
- LocalStorage, versioned save format (`version: 1`) in `systems/SaveLoad.ts`.
- Migration stub included for unknown future schemas.

## Performance Strategy
- Particle pooling, max 150 active particles.
- Audio pooling.
- Lightweight per-frame updates.
- Scale-to-fit 1080x1920 logical viewport.
