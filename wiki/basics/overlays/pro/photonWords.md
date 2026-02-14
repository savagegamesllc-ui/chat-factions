Photon Words

Off-screen laser beams sweep in from different angles to “write” glowing words on-screen, with occasional sparks and a heat-cooling fade. It’s most impactful during hype spikes, cheers, and subs when the beams get brighter and the words grow larger.

Overview

Photon Words uses layered visuals to simulate a laser writing effect: a visible beam draws each word, the lettering glows with a warm gold rim, and the finished text cools and fades away over time. Words can be triggered by hype threshold crossings, bits/cheers, and subscriptions, with different word sets per trigger type.

Hype Behavior

Low hype behavior
Words appear smaller and stay closer to the edges, firing only when hype crosses user-defined thresholds.

Medium hype behavior
Words grow and creep further away from the edges toward the center as hype increases.

High / spike behavior
At very high hype, the biggest words are selected from the max-hype word list. Sparks appear more noticeably during the laser “write” motion, and the beam/glow reads as more intense.

Faction Interaction

The laser beam and the written word color match the current hype leader’s color (winner-dominant), with a consistent warm gold rim around the effect.

Configuration Options

Hype Thresholds
Sets the hype point values that trigger a word when crossed upward.

Hype Trigger Cooldown
Minimum time between threshold-triggered words to prevent rapid repeat firing.

Hype Words (Low/Mid)
Comma-separated list of words used when hype thresholds trigger at low to mid hype.

Bits Word
The word written when bits/cheers occur.

Subs Word
The word written when subscription events occur.

Max Hype Words
Comma-separated list of words used at maximum hype.

Fade Speed (Quick/Mid/Slow)
Controls how quickly completed words cool and fade away.

Glow Strength (Low/Mid/High)
Controls the intensity of the glow around beams and lettering.

Sparks (Off/Low/Mid/High)
Controls how frequently sparks appear as the laser writes.

Laser Thickness (Thin/Mid/Thick)
Controls the beam thickness.

Laser Perspective (Low/Mid/High)
Controls how strongly the beam feels like it’s coming from off-screen/behind the camera.

Beam Strength (Low/Mid/High)
Overall visibility multiplier for the beam.

Beam Alpha
Controls the beam’s opacity.

Beam Glow (Low/Mid/High)
Controls the beam’s bloom intensity.

Beam Length (Full/Mid/Short)
Controls how much of the beam is visible from its origin to the writing point.

Beam Linger (ms)
Keeps the beam faintly visible for a short time after the writing finishes.

Beam Write Speed (Slow/Mid/Fast)
Controls how quickly the laser writes the word.

Beam Duration Override (ms)
Forces a fixed writing duration for all words (when set).

Low Edge Inset %
How close words stay to the edges at low hype.

Max Edge Inset %
How far inward words can move at higher hype.

Low Scale
Word size at low hype.

Mid Scale
Word size at medium hype.

Max Scale
Word size at max hype.

Font Family
Sets the font used for the written words.

Font Weight
Sets how bold the written words appear.

Performance Notes

Photon Words uses multiple layered effects (beam bloom, glow, sparks, and heat-style persistence). Higher glow, thicker beams, and higher spark settings increase GPU load. If you notice performance issues, reduce glow strength, set sparks lower/off, and use thinner beams.

Best Use Cases

High-energy streams with frequent hype spikes

Team shooters and competitive games

“Thanks for the sub” / “cheers” moments

Event nights where chat engagement is the main focus

Tier

PRO

Tips

If you want the beam to feel more “cinematic,” use longer beam length and higher beam glow.

If you want cleaner visuals for smaller overlays, reduce sparks and choose thin beams with mid glow.