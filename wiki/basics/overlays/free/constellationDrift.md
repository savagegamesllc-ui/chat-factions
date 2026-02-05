# Constellation Drift

A calm, subtle starfield where points of light drift across the screen and softly connect into fleeting constellations, most noticeable during steady audience engagement rather than sudden spikes.

---

## Overview

Constellation Drift displays a gentle field of small, twinkling stars that move slowly across the screen. When stars pass near each other, thin lines briefly form between them, suggesting constellation shapes that appear and fade without drawing focus away from the stream.

---

## Hype Behavior

- **Low hype behavior**  
  A minimal number of stars drift slowly with faint twinkling. Connections between stars are rare and very subtle.

- **Medium hype behavior**  
  More stars appear on screen, drifting a bit faster. Connections form more frequently, creating short-lived constellation patterns.

- **High / spike behavior**  
  Star density reaches its upper limit, movement becomes more lively, and connection lines extend farther. The effect remains restrained and never overwhelms the view.

---

## Faction Interaction

- **Blended / weighted**  
  Star and line coloration is subtly influenced by all active factions, blended together based on their relative hype levels.

- **Winner-dominant**  
  When enabled, the leading faction’s color becomes the primary tint influencing the stars and connections.

---

## Configuration Options

- **Placement**  
  Controls whether stars tend to originate near the edges of the screen or appear evenly across the full view.

- **Faction Mix**  
  Chooses between blended faction colors or a single dominant faction color.

- **Intensity**  
  Scales how strongly hype affects star count, motion, and connections.

- **FPS Cap**  
  Limits the maximum frame rate of the overlay.

- **Render Scale**  
  Adjusts internal rendering resolution to balance clarity and performance.

- **Max Stars**  
  Sets the maximum number of stars visible at high hype.

- **Connect Distance**  
  Controls how close stars must be to form connecting lines.

- **Line Opacity**  
  Adjusts how visible the connecting lines are.

- **Hype Scale (k)**  
  Determines how quickly the overlay responds as hype increases.

- **Hype Smoothing**  
  Controls how gradually changes in hype are applied visually.

- **Vignette**  
  Adds a subtle darkening toward the edges of the screen.

---

## Performance Notes

This overlay is designed to be lightweight, using a single canvas with capped star counts and connection limits to remain OBS-safe and suitable for lower-end systems.

---

## Best Use Cases

- Chill or cozy streams  
- Talk shows and podcasts  
- Late-night streams  
- Background ambiance during low- to mid-energy gameplay

---

## Tier

**FREE**

---

## Tips

- Works best when used as a background overlay rather than a focal visual.
- Pair with other overlays if you want stronger reactions during major hype spikes.
