# Content Authoring

This project is content-first: gameplay chains, generators, orders, rooms, episodes, letters, branches, and monetization catalogs are all JSON-driven.

## File Map

- `src/data/json/itemChains.json`
- `src/data/json/droptables.json`
- `src/data/json/orders.json`
- `src/data/json/letters.json`
- `src/data/json/branchMoments.json`
- `src/data/json/rooms.json`
- `src/data/json/episodes.json`
- `src/data/json/localization.en.json`
- `src/data/json/remoteConfig.json`
- `src/data/json/iapCatalog.json`

## Item Chains Schema

`itemChains.json`

- `id`: chain id (`woodworking`, `oceanic`, etc.)
- `nameKey`: localization key
- `icon`: UI icon string
- `tiers[]`:
  - `id`: unique item id
  - `tier`: 1-8
  - `nameKey`
  - `color`
  - `shape`: `circle|square|diamond|hex`
  - `sellValue`
  - `sourceGenerators[]`

## Generator Droptables Schema

`droptables.json`

- `id`: generator id
- `nameKey`
- `chainBias[]`
- `levels[]`:
  - `level`
  - `cooldownSec`
  - `drops[]`: `{ itemId, weight }`

## Orders Schema

`orders.json`

- `id`, `type`, `titleKey`, `descriptionKey`
- `timedSeconds?` for timed orders
- `minPlayerLevel`, `maxPlayerLevel`
- `requirements[]`: `{ chainId, tier, count }`
- `rewards`: `{ coins, stars, xp }`
- `triggerLetterId?`
- `triggerBranchMomentId?`

## Branch Moment Schema

`branchMoments.json`

- `id`
- `triggerOrderId`
- `roomId`
- `optionA` and `optionB`:
  - `id`
  - `title`
  - `description`
  - `decorFlag`
  - `letterId`

## Letters Schema

`letters.json`

- `id`
- `titleKey`
- `bodyKey`
- `mood`
- `trigger`

Body supports placeholders:

- `{player_name}`
- `{room_name}`
- `{decor_choice}`
- `{episode_number}`

## Rooms Schema

`rooms.json`

- `id`
- `nameKey`
- `unlockedAtEpisode`
- `styles[]`: `{ id, nameKey, color }`

## Episodes Schema

`episodes.json`

- `id`
- `nameKey`
- `unlockRoomId?`
- `steps[]`: `{ id, descriptionKey, requiredAction }`

## Localization

`localization.en.json` maps all keys to strings.
Keep keys stable and reference by id from JSON systems.

## Validation Tips

1. Ensure every `nameKey/titleKey/bodyKey` exists in localization
2. Ensure every `itemId` in droptables exists in item chains
3. Keep tier progression contiguous for chain merge behavior
4. Keep branch `triggerOrderId` aligned with order ids
