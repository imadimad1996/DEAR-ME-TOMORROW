# QA & Performance Checklist

## Device Matrix
- Android Chrome mid-tier phone
- iOS Safari recent device
- Desktop Chrome sanity

## Performance Checklist
- Verify gameplay remains near 60 FPS in merge scene.
- Confirm no major hitch during legendary cinematic.
- Confirm particle count remains bounded (<=150 active).
- Validate audio pool plays without overlap glitches.

## Profiling Steps
1. Open Chrome DevTools Performance tab.
2. Record 20-30s while repeatedly spawning and merging.
3. Verify frame times and check for GC spikes.
4. Use Memory tab to verify no persistent sprite leaks.

## Lighthouse
- Run Lighthouse in PWA + Performance mode.
- Confirm manifest and service worker are detected.

## FPS Overlay
- Press `F` in runtime to toggle FPS text overlay.
