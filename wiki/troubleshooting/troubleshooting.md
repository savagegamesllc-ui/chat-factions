# Troubleshooting

## Overlay not updating
- Refresh the Browser Source in OBS
- Reload the dashboard page
- Confirm the overlay is the selected active layout

## Overlay not visible
- Confirm source order in OBS (overlay should be on top)
- Ensure overlay isn’t fully transparent at low hype
- Try triggering hype or using a test mode (if available)

## Lag / frame drops
- Reduce FPS cap in overlay config
- Reduce particle maximum
- Disable expensive effects (glow, bloom, extra layers)

## Audio not working (if using audio overlays)
- Confirm the browser source is not muted
- Confirm OBS audio monitoring/mixer settings
- Note: Some OBS browser audio features differ by platform
