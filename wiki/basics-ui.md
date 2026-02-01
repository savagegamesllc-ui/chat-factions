# Basics: Using the Dashboard UI

The **Streamer Dashboard** is where you configure everything:
- your overlay URL(s)
- which overlay layout is active
- factions and their colors
- chat commands
- live meter behavior

## The main sections

### Dashboard
Your quick “home” view.
- Shows your OBS overlay URL
- Includes a preview (if enabled)
- Shows current plan (FREE/PRO)
- Shows helpful status/summary info

### Layouts
Where you choose and configure overlays.
Typical workflow:
1. Select an overlay layout
2. Save/activate it
3. Copy your overlay URL into OBS

You’ll also see overlay configuration controls (sliders, toggles, numbers).
Those control intensity, performance limits, and positioning.

### Factions
Factions are the teams your viewers join.
Here you can:
- create / rename factions
- set colors
- enable/disable factions
- manage viewer membership rules (if enabled)

### Meters
Meters are the live “hype levels” per faction.
This is what overlays react to.
If the overlay is running, changes here should update in real time.

### Chat
Where you configure chat commands and behavior:
- join/switch commands
- hype commands
- cooldowns
- safety limits / clamping

### Event API
(Optional / advanced) A way for external systems to trigger hype:
- game events (kills, wins, objectives)
- stream integrations
- custom automation

### Billing
Shows your plan tier and manages upgrades.

## How changes apply
Most settings apply instantly:
- Overlay config changes take effect right away
- No OBS restart required

If something doesn’t update:
- Refresh the OBS browser source
- Or reload the dashboard page

Next: [Basics: Adding the Overlay to OBS](basics-obs)
