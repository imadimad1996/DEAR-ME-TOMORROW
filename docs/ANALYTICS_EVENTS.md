# Analytics Events

All events are logged via `systems/analytics/Analytics.ts` to console + localStorage buffer.

| Event | Params | Fired From |
|---|---|---|
| `time_to_first_merge` | `sinceStartMs` | `Board.executeMerge` first merge |
| `merge_count` | `chainId`, `tier` | `Board.executeMerge` |
| `merge_depth` | `depth` | `Board.executeMerge` |
| `echo_trigger_frequency` | `triggerCount`, `mergesObserved`, `ratio` | `EchoSystem` |
| `order_abandonment` | `orderId`, `progress`, `target` | `OrdersSystem.reroll` |
| `ad_opt_in` | `source` | `MergeBoardScene.simulateRewardedAd` |
| `ad_complete` | `completed` | `RewardedAdFlowUI callback` |
| `rage_quit_proxy` | `withinMs` | `MergeBoardScene.exit` |
| `session_length` | `seconds` | `Analytics` unload hook |
| `room_completion_pacing` | `roomId`, `stars` | `MergeBoardScene.update` |
| `letters_opened` | `id` | `LettersSystem.openLetter` |
| `letter_read_time` | `id`, `readMs` | `LettersSystem.closeLetter` |
| `skip` | `id` | `LettersSystem.closeLetter` when skipped |
| `energy_zero_events` | `total` | `EnergySystem.spend` |
| `energy_zero_duration` | `ms` | `EnergySystem.grant` |
| `board_clutter_events` | `blockedCells`, `reason` | `Board` + `MergeBoardScene` |
