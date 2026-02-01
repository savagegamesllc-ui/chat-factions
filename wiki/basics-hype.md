# Basics: Hype & Factions

Chat Factions is powered by **Hype**.

## What is Hype?
Hype is a live score that grows based on viewer activity and events.
Overlays use hype to drive:
- intensity
- particle counts
- glow / pulse effects
- “big moment” reactions (spikes)

## What are Factions?
Factions are teams in chat.
Viewers join a faction, and their actions contribute hype to that faction.

Each faction has:
- a name
- a color
- a meter value (its current hype level)

## How overlays use factions
Different overlays can interpret factions differently:
- **Weighted blend:** all factions contribute; colors mix based on meter values
- **Winner-takes-most:** the leading faction dominates the color and effects
- **Split UI:** multiple factions show at once in different regions

## Hype spikes
Some overlays respond strongly to sudden changes.
Examples:
- a burst of bits
- a raid
- multiple chat triggers at once

If an overlay becomes too strong at max hype:
- reduce intensity
- increase the “hype scale” value (so it ramps slower)
- cap max particles/effects

Next: [Overlays (Hub)](overlays)
