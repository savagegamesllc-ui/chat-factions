This document is written for another ChatGPT instance or a human developer to pick up without needing this chat.

Chat Factions – Architecture, Current State, and Next Steps
Project Overview

Chat Factions is a Twitch-integrated overlay system for streamers that allows real-time audience interaction (votes, bits, subs, etc.) to visually affect stream overlays (e.g., flame edges growing based on hype).

The system has three distinct roles / surfaces:

Owner Interface (/manage)

Admin / platform owner tools

Manage overlay layouts

Assign FREE / PRO tiers

View users (streamers)

Grant PRO access

View system / DB debug info

Streamer Dashboard (/admin/dashboard)

Streamer-facing configuration UI

Select overlay layout

Customize overlay parameters

Manage factions

Upload assets (brands, frames)

Billing (Stripe integration)

Overlay Runtime (/overlay/*)

OBS browser source

Loads JS overlay styles

Connects to WebSocket

Displays live visuals

Core Architectural Concepts
1. Overlay Styles vs Overlay Layouts (IMPORTANT)

These are not the same thing.

Overlay Style (code-based)

Lives on disk:

public/overlays/styles/flameEdge.js


Defines:

Rendering logic

styleMeta schema (controls, defaults)

Loaded dynamically in browser via:

import(`/overlays/styles/${styleKey}.js`)

Overlay Layout (database-based)

Stored in Prisma model OverlayLayout

Represents:

A named, selectable layout

Tier (FREE or PRO)

styleKey → which style module it uses

Example:

OverlayLayout:
  id
  name: "Flame Edge – Bottom"
  styleKey: "flameEdge"
  tier: "FREE"
  isActive: true


👉 Layouts are what streamers choose
👉 Styles are what overlays render

2. Streamer Layout Selection (NEW MODEL)

Instead of storing just streamer.overlayStyle, we now use:

StreamerLayout (join table)
StreamerLayout:
  streamerId
  layoutId
  isEnabled
  isSelected


Rules:

A streamer can have many layouts

Only one layout is selected

Overlay runtime always prefers selected StreamerLayout

Fallback exists for legacy streamer.overlayStyle

3. Overlay Runtime Flow (OBS)

OBS loads:

/overlay/hud?token=XYZ&style=flameEdge


Backend:

Resolves streamer by token

Checks StreamerLayout.isSelected

Determines styleKey

Logs overlay view (analytics)

Frontend:

Loads:

/overlays/styles/<styleKey>.js


Connects to WebSocket

Renders visuals based on live state

Server Structure (Important Files)
src/
├─ server.js                 # App bootstrap
├─ config/
│  └─ env.js                 # Central env loader (dotenv/config)
├─ routes/
│  ├─ ownerRoutes.js         # /manage (owner UI + APIs)
│  ├─ dashboardRoutes.js     # /admin/dashboard (streamer UI)
│  ├─ overlayRoutes.js       # /overlay runtime
│  └─ authRoutes.js          # Twitch auth
├─ ws/
│  └─ wsServer.js             # WebSocket logic
├─ views/
│  ├─ layouts/
│  │  └─ dashboard.html
│  ├─ partials/
│  │  └─ dashboardBody.html

Environment Handling (CRITICAL)
.env is loaded via:
import 'dotenv/config';


Single source of truth:

f:/chat-factions/.env


Access pattern:

import { env } from "./config/env.js";


Never access process.env.X directly elsewhere.

Owner Interface (/manage)
Purpose

Platform admin tools.

Current Status

✅ UI loads
✅ Authentication works
✅ DB connectivity verified
⚠️ CRUD actions partially wired

Key Responsibilities

Manage OverlayLayout

Activate / deactivate layouts

Set layout tier (FREE / PRO)

View streamers

Grant permanent PRO

View DB debug info

Important Note

Owner UI is not Twitch-authenticated.
Uses session-based login.

Streamer Dashboard (/admin/dashboard)
Purpose

Streamer configuration UI.

Tabs

Basics (OBS URLs)

Factions (vote config)

Overlays (layout selection + controls)

Assets (upload images)

Billing (Stripe)

Current State

✅ Page renders
✅ Tabs work reliably (guarded JS)
✅ Layout dropdown exists
⚠️ Some data still not injected correctly
⚠️ Dashboard routes still partially legacy (style-based)

Recent Critical Fixes
Tabs-only page bug

Cause: JS crash prevented .active tab assignment
Fix:

Basics tab active by default

Tab JS isolated from rest of page

All other logic wrapped in try/catch

DB Hanging / Undefined URL

Cause: .env not loaded consistently
Fix:

Unified env.js

Explicit dotenv/config usage

DB connectivity verified via debug endpoint

Known Issues (To Be Fixed Next)

dashboardRoutes.js

Still mixes old overlayStyle logic with new StreamerLayout

Needs cleanup:

Prefer DB layouts everywhere

Legacy fallback only if no layout selected

Overlay analytics

overlayView insert error previously due to schema mismatch

Needs schema alignment (no styleKey field if not defined)

Stripe integration

Exists but unverified after refactors

Needs testing after dashboard stabilization

Owner UI actions

Layout CRUD

User PRO grants

Still incomplete

Design Philosophy (IMPORTANT)

Disk = code

Database = configuration

Owner controls availability

Streamer controls selection

Overlay runtime must never trust UI

Fallbacks always exist

This separation is intentional and should be preserved.

High-Level Goal (Vision)

Enable a streamer to:

Log in with Twitch

Select from approved overlay layouts

Customize visuals

Copy OBS URL

Go live

Watch chat-driven visuals evolve in real time

Enable owner to:

Add new overlay styles by dropping JS files

Create layouts pointing to styles

Gate premium layouts

Monetize via Stripe