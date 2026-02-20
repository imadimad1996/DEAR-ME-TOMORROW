# Tuning Guide

Most balancing values are controlled from `src/data/json/remoteConfig.json`.
Use in-game **Refresh Config** button to hot-reload while running `npm run dev`.

## Key Knobs

## Energy

- `energy.max`
- `energy.regenSeconds`
- `energy.offlineRegenCap`
- `energy.generatorSpawnCost`
- `energy.miniModeEntryCost`
- `energy.rvReward`
- `energy.rvCooldownSeconds`
- `energy.rvDailyCap`

## Time Echo

- `echo.baseChance`
- `echo.earlyGameChance`
- `echo.earlyGameLevelCap`
- `echo.newRoomBoost`
- `echo.streakPerFiveMerges`
- `echo.streakMaxBonus`
- `echo.eventBoost`
- `echo.vipBoost`
- `echo.pityThreshold`
- `echo.maxActiveEchoes`
- `echo.echoLifetimeHours`
- `echo.choiceGraceSeconds`
- `echo.pendingQueueMax`

## Inventory

- `inventory.baseSlots`
- `inventory.maxSlots`
- `inventory.expiryHours`

## Global

- `features.matchMiniModeEnabled`
- `features.eventBoostEnabled`
- `features.vipBonusEnabled`
- `autosaveSeconds`

## Additional Tuning Data

- Generator output and cooldown per level:
  `src/data/json/droptables.json`
- Order difficulty and rewards:
  `src/data/json/orders.json`
- XP/level behavior:
  `src/game/GameSimulation.ts` (`grantXp`)
- Daily tasks and targets:
  `src/game/GameSimulation.ts` (`TASK_TEMPLATES`)

## Quick Balance Workflow

1. Run `npm run dev`
2. Edit `remoteConfig.json`
3. In game, tap **Refresh Config**
4. Use Debug panel to force test scenarios
5. Check analytics panel for event flow

## Save/Migration Notes

Save schema version is managed in `src/services/SaveService.ts`.
When changing persisted structures:

1. Add new `version`
2. Write migration from old version
3. Test loading old saves + fresh saves
