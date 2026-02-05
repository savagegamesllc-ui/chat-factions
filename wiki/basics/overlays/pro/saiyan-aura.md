Saiyan Aura (PRO)

Saiyan Aura is a high-impact, character-centric overlay inspired by classic “power-up” anime transformations. It creates the illusion of a three-dimensional energy shell surrounding the streamer, starting as a faint white airflow and building into a blazing, faction-powered aura with a permanent golden rim.

This overlay is designed to feel contained, powerful, and alive without overwhelming the stream or obscuring the streamer’s camera.

Visual Concept

At low hype, the overlay is intentionally subtle—barely visible wisps of white air rising and twisting. As hype increases, the aura:

Thickens and speeds up

Gains faction-blended color

Develops a bright, gold/yellow outer rim

Begins to “breathe” and shimmer with energy

Despite being rendered in 2D, the aura uses depth shading, layered motion, and curvature tricks to appear like a three-dimensional shell wrapping around a character.

Hype Behavior
Hype Level	Visual State
0	Almost invisible white airflow
Low	Soft white swirl, slow movement
Medium	Faction color begins to emerge
High	Thick aura, strong glow, gold rim bright
Max	Intense shimmer, faster motion, white-hot highlights

The aura never explodes outward—it stays wrapped around the streamer to preserve readability and immersion.

Faction Color Logic

Saiyan Aura fully supports faction color blending:

Weighted mode blends all active factions based on meter values

Winner mode uses the leading faction’s color

Faction color influences the inner energy, while the outer rim always remains gold/yellow to preserve the iconic power-up look.

At very high hype, the aura partially shifts back toward white (“white-hot”) for dramatic effect.

Performance & OBS Safety

Single canvas renderer

No DOM churn

FPS capped and DPI capped

No heavy particle systems

Avatar-safe center region

This overlay is safe for long streaming sessions and performs well even at high hype levels.

Configuration Options
Placement & Shape
Setting	Description
Center X / Center Y	Position of the aura center (usually aligned with webcam subject)
Aura Width	Horizontal size of the aura shell
Aura Height	Vertical size of the aura shell
Motion & Flow
Setting	Description
Band Count	Number of energy ribbons forming the aura
Segments	Vertical resolution of each ribbon (higher = smoother, heavier)
Twist	How much the aura spirals vertically
Swirl Speed	Rotational energy speed
Rise Speed	Vertical upward motion speed
Color & Intensity
Setting	Description
Intensity	Global power multiplier
Base Opacity	Visibility at low hype
Faction Mix Mode	Weighted or Winner
Color Start (h)	Hype level where faction color begins
White-Hot at Max	How much the aura returns to white at max hype
Golden Rim Controls
Setting	Description
Rim Strength	Brightness of the gold border
Rim Width	Thickness of the gold border
Rim Glow	Soft glow strength around the rim
Glow & Atmosphere
Setting	Description
Inner Glow	Glow strength of the inner energy
Background Dim	Optional screen darkening at high hype
Vignette	Edge darkening to focus attention inward
Performance Controls
Setting	Description
FPS Cap	Frame rate limit
DPR Cap	Device pixel ratio limit
Hype Smoothing	How quickly the aura reacts to hype changes
Recommended Use

Saiyan Aura works best when:

The streamer has a visible webcam/avatar

The aura can wrap around the subject

The stream emphasizes “big moments” and hype buildup

You want a transformation feel rather than explosions or particles

It pairs especially well with hype systems that build steadily toward major moments.

Tier

🔒 PRO Overlay

This overlay is exclusive to PRO streamers due to its advanced rendering and customization options.