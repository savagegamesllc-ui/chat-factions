# Basics: Adding the Overlay to OBS

Chat Factions overlays are added to OBS using a **Browser Source**.

## Step-by-step setup

### 1) Copy your overlay URL
In the dashboard, find **OBS Overlay URL** and copy it.

### 2) Add a Browser Source in OBS
In OBS:
1. Select your scene
2. In **Sources**, click **+**
3. Choose **Browser**
4. Name it (example: `Chat Factions Overlay`)
5. Click **OK**

### 3) Paste the overlay URL
Paste the copied URL into the Browser Source URL field.

### 4) Recommended settings
Use these defaults unless you have a reason not to:

- Width: `1920`
- Height: `1080`
- ✅ Refresh browser when scene becomes active
- ✅ Shutdown source when not visible (optional; saves resources)

> If your overlay uses audio later: leave “Control audio via OBS” **off** until you want that behavior.

### 5) Layering tips
- Put the overlay source **above** your camera/game sources if it should appear on top
- If the overlay is meant to frame your camera, position it accordingly

## Troubleshooting

### Overlay not showing
- Confirm the URL is correct
- Make sure the overlay is enabled/selected in **Layouts**
- In OBS, right-click the Browser Source → **Refresh**

### Overlay shows in dashboard preview but not OBS
- Double-check the browser source dimensions
- Ensure no filters are hiding it (opacity, crop, etc.)

### Overlay is laggy
Go to Layout settings and lower:
- FPS cap
- particle counts
- “max embers” / “max effects” style settings

Next: [Basics: Hype & Factions](basics-hype)
