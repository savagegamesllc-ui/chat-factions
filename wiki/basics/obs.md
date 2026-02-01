# Adding the Overlay to OBS

Chat Factions overlays are added to OBS using a **Browser Source**.

This method works on all major platforms and does not require plugins.

---

## Step-by-Step Setup

### 1. Copy your Overlay URL
On the dashboard, locate your **OBS Overlay URL** and copy it.

This URL is:
- Unique to you
- Safe to use in OBS
- Automatically connected to your account

---

### 2. Add a Browser Source in OBS
In OBS:

1. Select your scene
2. Under **Sources**, click **+**
3. Choose **Browser**
4. Name it something recognizable (e.g. *Chat Factions Overlay*)
5. Click **OK**

---

### 3. Paste the Overlay URL
Paste the copied URL into the **URL** field of the Browser Source.

---

### 4. Recommended Settings

For best results:

- Width: `1920`
- Height: `1080`
- ✅ Refresh browser when scene becomes active
- ⛔ Control audio via OBS (leave off unless needed)

These settings match a standard 1080p canvas and work for most overlays.

---

### 5. Positioning the Overlay
- Place the overlay source **above** your camera or game source if it should appear on top
- Resize or crop only if the overlay is designed for a specific region

---

## Troubleshooting

### Overlay not visible
- Confirm the URL is correct
- Ensure a layout is selected in **Layouts**
- Right-click the Browser Source → **Refresh**

### Overlay appears blank
Some overlays are subtle at low hype.
- Trigger hype via chat or test events
- Check meter activity in the dashboard

### Overlay is laggy
Lower performance-heavy settings in **Layouts**:
- FPS cap
- Particle or effect limits
- Intensity

These changes usually take effect immediately.
