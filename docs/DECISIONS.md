# Implementation Decisions

## Engine Choice
- Chosen: PixiJS 7 (preferred path from prompt).
- Reason: fast 2D workflows, straightforward custom scene + pooling architecture.

## Scope Interpreted
- Prompt asked full root rebuild; existing project files were replaced.
- Placeholder `.png` and `.wav` files are valid minimal binaries with exact required names.

## Ambiguity Resolutions
- Match mini-mode implemented as a lightweight swap + match stub.
- Echo branching cinematic implemented as callable stub only.
- Starter pack and daily reward are UI/flow stubs (no real purchase backend).
- KPI monthly table values were inferred planning targets due missing concrete source table.

## Tween Library
- Implemented custom lightweight tween manager (`engine/Tween.ts`) instead of external dependency.

## Service Worker
- Implemented simple cache-first shell with runtime caching for GET requests.
- Designed as starter baseline, not production-grade offline invalidation policy.
