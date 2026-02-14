theGrid

A TRON-inspired circuit border that routes glowing rails from a left-side CPU hub out to selected screen edges, with flowing data packets that visually reflect faction hype.

Overview

theGrid draws a compact “CPU” module on the middle-left of the screen and connects it to circuit rails that run along the edges you enable. The rails have a soft neon glow, subtle PCB-style details, and lively corner traces that pulse randomly to keep the overlay feeling active even during low hype.

Each rail is colored by its faction, and the CPU glows in the color of the current hype leader.

Hype Behavior

CPU glow (leader): The CPU’s glow follows the current hype leader’s color and intensifies as hype rises.

Data packets (per faction): Small glowing “data packets” travel outward from the CPU along each faction’s rails.

More hype = more packets (higher frequency), so high-hype factions look busier and more “alive.”

Always-visible baseline: If no live hype data is available, the overlay still shows a low baseline activity so streamers can preview what it looks like.

Event Reactions

Bits/Cheers: Triggers a burst of sparks on the rails associated with the sender’s faction.
If the sender’s faction can’t be determined, it defaults to the streamer’s first faction.

Subs: Triggers full pandemonium—a large-scale overload reaction where all rails and packet activity surge at once.

Look and Feel

Cyber PCB style: Rails include PCB-like accents (small pads/vias) and a soft glow.

Corner “PCB life”: Extra decorative traces in the corners pulse randomly (not tied to hype) to add motion and depth.

Rail endpoints: Active rails terminate with small circular endpoints to match real PCB trace styling.

Settings
Edge Selection

Choose which screen edges are active:

top_edge: yes/no

right_edge: yes/no

bottom_edge: yes/no

left_edge: yes/no

Base Background Glow

Adds a low, atmospheric background glow across the overlay:

baseGlowColor: cyberBlue | neonGreen | ledRed | digitalWhite

baseGlowStrength: intensity of the background glow

PCB Detail Controls

cornerPcb_enabled: enables the pulsing corner traces

railPcb_enabled: enables PCB-style detailing on the rails

Rail Density and Style

railsPerEdge: number of rails per enabled edge (up to 6)

railThicknessPct: overall rail thickness (scales with resolution)

end45Chance: chance for some terminations to end with a 45° angle

Demo Mode

Helps streamers preview theGrid without needing live hype traffic:

demo_enabled: yes/no
When enabled, the overlay cycles between a low and high activity look over time.

Placement Notes

Designed to scale smoothly across resolutions.

The CPU remains on the middle-left and the rails route outward to whichever edges are enabled.

This overlay works best when it has clean screen space near the edges (don’t bury it under thick camera frames).

Best Uses

Team shooters and sci-fi / cyberpunk streams

Streams where you want hype to feel like “system power” rather than flames or particles

Layouts where the edges are visible and not heavily cropped

Troubleshooting

“It looks too quiet”: Enable Demo Mode to preview higher activity, or verify hype events are coming through.

“I don’t see sparks on bits”: Make sure bits/cheer events are enabled for your channel and that the overlay is connected to your session.

“It feels too bright”: Lower baseGlowStrength, reduce railThicknessPct, or disable corner PCB life.