Pulse Strip

A silver, utility-style strip that sits on an edge of the screen and shows a live numeric hype readout, with subtle faction-colored accents that become more active as hype rises.

Overview

Pulse Strip is a clean “HUD bar” overlay with a silver metallic background. A muted accent color (based on the current faction state) is used for the border and moving pulse packets. The left side tucks a small “Chat Factions” label, while the right side displays a numeric hype value and (optionally) the count of active factions.

Hype Behavior

Low hype behavior
The strip is present but restrained: the silver background is steady, the accent border is subtle, and pulses move gently with minimal glow.

Medium hype behavior
The overlay becomes more noticeable: pulses brighten and feel more active, and the accent glow increases without overpowering the silver base.

High / spike behavior
The strip looks energized: pulses appear stronger and faster, the border reads brighter, and the glow intensifies while staying within a muted accent range.

Faction Interaction

Winner-dominant
The accent color follows the current leading faction.

Blended / weighted
The accent color can be computed as a weighted blend across factions.

In both cases, the faction color is intentionally muted (“spectrum shrink”) so the overlay keeps a silver/neutral look rather than becoming fully saturated.

Configuration Options

Placement
Positions the strip on the top, bottom, left, or right edge of the screen.

Thickness
Controls how tall (top/bottom) or wide (left/right) the strip is relative to the screen.

Inset
Adds margin from the screen edges so the strip can sit slightly away from the border.

Corner Radius
Adjusts how rounded the strip’s corners appear.

Faction Mix
Chooses whether the accent color is winner-dominant or a weighted blend.

Intensity
Overall strength of the effect.

Silver Strength
Controls how strongly the overlay reads as silver/neutral.

Spectrum Shrink
Reduces how saturated the faction accent color appears, keeping the overlay restrained.

Background Alpha
Transparency of the silver base.

Border Alpha
Transparency of the accent border.

Border Width
Thickness of the border line.

Glow Strength
Strength of the accent glow.

Enable Pulses
Turns the traveling pulse packets on or off.

Pulse Count
Number of pulse packets visible at once.

Pulse Speed
How fast pulse packets travel along the strip.

Pulse Width
How wide each pulse packet appears.

Pulse Softness
Softness of pulse edges (sharper vs more diffuse).

Enable Text
Shows or hides the text layer.

Uppercase Text
Forces text to render in uppercase.

Text Alpha
Transparency of the text.

Font Size
Scales the text size relative to the strip.

Title Text
The small label shown in the left corner (defaults to “Chat Factions”).

Show Active Factions
Shows or hides the active faction count in the readout.

Number Format
Displays hype as a full integer or a compact form (e.g., 1.2k).

Hype Scale (k)
Tunes how quickly the overlay ramps up its visual intensity as hype increases.

Max Total Clamp
Caps the total hype value used for visual scaling.

Hype Smoothing
Smooths changes in hype so the overlay transitions feel less jumpy.

FPS Cap
Limits animation framerate for performance control.

Performance Notes

Pulse Strip includes an FPS cap option and avoids heavy particle effects. No other special performance considerations were noted for this overlay.

Best Use Cases

Clean FPS / shooter layouts where overlays must stay unobtrusive

Streams that want a “broadcast-style” status element without large graphics

Minimalist setups that still want visible hype feedback

As a secondary accent overlay paired with other on-screen elements

Tier

FREE

Tips

If you want the overlay to stay subtle across all factions, increase Spectrum Shrink and keep Glow Strength modest.

If the strip competes with UI elements, increase Inset and reduce Background Alpha.