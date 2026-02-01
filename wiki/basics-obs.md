# Adding a Chat Factions Overlay to OBS

Chat Factions overlays use OBS **Browser Sources**.

## Step-by-Step Setup

### 1️⃣ Open OBS
- Go to your scene
- Click **➕** under Sources
- Choose **Browser**

### 2️⃣ Create the Browser Source
- Name it something like:
  > Chat Factions Overlay
- Click **OK**

### 3️⃣ Paste Your Overlay URL
In the URL field, paste the **Overlay URL** from your dashboard.

This URL is:
- Unique to you
- Safe to use in OBS
- Automatically connects to your stream

### 4️⃣ Recommended Settings
Set the following for best results:

- Width: `1920`
- Height: `1080`
- ✅ Refresh browser when scene becomes active
- ❌ Control audio via OBS (unless overlay uses sound)

### 5️⃣ Click OK
Your overlay should appear immediately.

---

## Troubleshooting

**Overlay not showing?**
- Confirm the URL is correct
- Make sure the overlay is enabled in the dashboard

**Overlay lagging?**
- Lower FPS cap in overlay settings
- Reduce particle counts
- Disable extra effects

**Overlay frozen?**
- Right-click the Browser Source → Refresh
