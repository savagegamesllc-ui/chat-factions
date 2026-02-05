Crownfall (PRO)

A single top-center spectral crown that grows with hype and rains falling sparks, with the most impact during big spikes and high-hype moments.

Overview

Crownfall renders one crown (not multiple staggered crowns) as a glowing, slightly 3D emblem near the top-center of the screen, while embers and sparks fall beneath it. The crown maintains a spectral glow, and particle effects provide most of the motion and intensity.

Hype Behavior

Low hype behavior
The crown is present with a subtle glow and minimal particle activity.

Medium hype behavior
The crown becomes larger and more energetic, with increased falling embers and sparks.

High / spike behavior
The crown reaches its largest size and strongest glow, with the heaviest ember/spark output. Spikes intensify the effect, including flare-like bursts that make the crown feel more active.

Faction Interaction

Blended / weighted
The crown’s coloration uses a blended/weighted faction influence.

Single faction focus
Falling sparks shift to the color of the faction with the highest hype.

Configuration Options

fpsCap
Limits the overlay’s frame rate.

crownRenderScale
Reduces internal crown rendering resolution to improve performance.

hypeK
Controls how quickly hype intensity ramps up.

maxTotalClamp
Caps the effective total used for hype calculations.

hypeSmoothing
Smooths how quickly visuals respond to hype changes.

crownX
Moves the crown horizontally.

crownY
Moves the crown vertically.

crownWidth
Adjusts the crown’s width.

crownHeight
Adjusts the crown’s height.

crownTilt
Slightly rotates the crown.

crownOpacity
Controls the crown’s overall opacity.

crownGlow
Controls the crown’s glow strength.

crownLineWidth
Adjusts crown outline thickness.

crownGemCount
Changes how many crown peaks/gems are visible.

crownDepth
Increases the crown’s 3D depth shading.

crownCastShadow
Controls the strength of the crown’s shadow.

crownShadowSoftness
Controls how soft the crown’s shadow appears.

crownShadowOffset
Controls how far the shadow is offset.

flareAttack
Controls how quickly flare intensity rises.

flareRelease
Controls how quickly flare intensity falls.

flareStrength
Controls overall flare intensity.

eventBoost
Increases responsiveness to hype spikes.

spikeSensitivity
Tunes how strongly spikes affect flare intensity.

emberEnabled
Toggles falling embers.

emberMax
Limits the maximum number of embers/sparks on screen.

emberSpawnCapPerFrame
Limits how many embers can spawn in a single frame.

emberRate
Base ember spawn rate.

emberBoost
Additional ember spawn during higher hype/spikes.

emberLife
How long embers remain visible.

emberSize
Ember size.

emberSpeed
Ember initial fall speed.

emberGravity
Ember fall acceleration.

emberDrift
Side-to-side drift amount.

emberTurbulence
Randomized motion strength.

emberGlow
Ember glow strength.

emberAlpha
Ember transparency.

emberHueSpeed
Speed of ember color cycling.

sparkEnabled
Toggles falling sparks.

sparkRate
Base spark spawn rate.

sparkBoost
Additional spark spawn during higher hype/spikes.

sparkSize
Spark size.

sparkLife
How long sparks remain visible.

backgroundDim
Adds a subtle darkening behind the effect.

vignette
Adds a vignette to frame the screen.

saturation
Controls overall color saturation.

biasStrength
Controls how strongly faction color influences the look.

chromaSplit
Present for compatibility, but the final version renders a single crown (no staggered multi-crown effect).

Performance Notes

The overlay includes explicit performance controls and caps to keep it stable at 1080p, including a frame-rate cap, reduced internal render scale for the crown, a maximum ember limit, and a per-frame spawn cap to prevent particle spikes from overwhelming the renderer.

Best Use Cases

High-energy chat moments where hype ramps quickly

Big events that create short, intense spikes

Streams where a top-center emblem can sit above an avatar/camera frame without blocking gameplay

Tier

PRO