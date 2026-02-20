# MERGE MANOR: LETTERS FROM TOMORROW (HTML5 Vertical Slice)

Production-ready TypeScript + Vite vertical slice for portrait mobile web (iOS/Android browser), with scalable architecture for future content and liveops.

## Run

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Controls

- Drag items between board/inventory/order drop zone/trash
- Merge by dropping same item types together
- Hold item (500ms) for tooltip
- Double tap same item type to auto-merge all possible pairs (2s cooldown)
- Hold trash to bulk-scrap tier 1-2 items
- Tap generators from bottom controls

## Mobile Notes

- Portrait virtual resolution: `1080x1920`
- Auto letterboxing/scaling to fit device viewport
- One-hand controls concentrated in lower half
- Works in Safari iOS and Chrome Android as web app
- Ready for Capacitor wrapping later (no native SDK dependency in current slice)

## Implemented Systems

- 8x7 board merge gameplay with drag threshold, snap, invalid-return animation
- Tier chains (4 chains, 8 tiers each) from JSON data
- Energy with regen + offline cap + rewarded-ad stub
- Inventory with capacity and expiry conversion
- Generators with cooldowns and droptables
- Orders (3 active +2 queued), rerolls, forced replacement rules
- Time Echo system (chance modifiers, pity, pending queue, forced choice modal)
- Branch moments (3), decor flags, room style application
- Letter inbox, read/favorite, and image share export
- Progression episodes 1-3 with onboarding step tracking
- Daily tasks, login streak, weekly event stub
- Analytics event manager (console + in-memory history)
- IAP and Ads architecture stubs
- Versioned save/load with migration `v1 -> v2`

## Architecture Overview

- `src/app`: App bootstrap and orchestration
- `src/engine`: Loop, viewport scaling, pointer input, canvas renderer
- `src/game`: Gameplay simulation and rules (board/orders/echo/liveops)
- `src/services`: Data/repository, save/load, analytics, ads/iap, RNG, localization
- `src/ui`: DOM overlay menus/modals/debug/inbox
- `src/data/json`: Content, localization, tuning and config data
- `docs/`: authoring and tuning references

Core rule execution lives in `src/game/GameSimulation.ts` and rendering lives in `src/engine/CanvasRenderer.ts`, keeping logic and visuals separated.

## Add New Content

### Add item chains

1. Edit `src/data/json/itemChains.json`
2. Add 8 tier entries per chain (or extend type constraints if expanding)
3. Add localization keys in `src/data/json/localization.en.json`
4. Update generator droptables in `src/data/json/droptables.json`

### Add orders

1. Append order definitions in `src/data/json/orders.json`
2. Provide `titleKey`/`descriptionKey` in localization
3. Optional: attach `triggerLetterId` and `triggerBranchMomentId`

### Add letters

1. Append definitions in `src/data/json/letters.json`
2. Add localization title/body keys
3. Trigger from orders or echo branch options

### Add rooms/styles

1. Edit `src/data/json/rooms.json`
2. Add style keys to localization
3. Ensure episode unlock data in `src/data/json/episodes.json`

## Save Data

Saved in LocalStorage with schema versioning via `src/services/SaveService.ts`.
Includes:

- `player_progress`
- `inventory_state`
- `board_state`
- `generator_states`
- `episode_progress`
- `decor_choices`
- `letter_inbox`
- `echo_queue`
- `event_progress`
- `purchase_history`
- order + energy + config cache sections

## Important Files

- `src/game/GameSimulation.ts`: main gameplay rules
- `src/engine/CanvasRenderer.ts`: canvas UI + item drawing
- `src/ui/OverlayUI.ts`: menus/modals/debug/liveops panels
- `src/data/json/remoteConfig.json`: balancing knobs
- `docs/CONTENT_AUTHORING.md`: schema authoring guide
- `docs/TUNING.md`: balancing and live tuning guide
