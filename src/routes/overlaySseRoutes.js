// src/routes/overlaySseRoutes.js
export async function registerOverlaySseRoutes(app, { prisma, sseHub }) {
  // GET /overlay/sse?token=...
  app.get("/overlay/sse", async (req, reply) => {
    const token = String(req.query?.token || "").trim();
    if (!token) return reply.code(400).send("Missing token");

    const streamer = await prisma.streamer.findFirst({
      where: { overlayToken: token },
      select: { id: true },
    });

    if (!streamer) return reply.code(404).send("Overlay token not found");

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no"); // nginx friendliness

    // If you use compression plugin, you may need to disable it for SSE.
    reply.raw.flushHeaders?.();

    const streamerId = streamer.id;

    function sendEvent(evt) {
      // SSE format: event + data + double newline
      // Keep it simple: all in "message" event
      reply.raw.write(`event: message\n`);
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    // Initial hello
    sendEvent({
      type: "hello",
      ts: Date.now(),
      streamerId,
      payload: { ok: true },
    });

    // Subscribe to hub
    const unsub = sseHub.subscribe(streamerId, (evt) => {
      try { sendEvent(evt); } catch {}
    });

    // Keepalive
    const ping = setInterval(() => {
      try { reply.raw.write(`: ping ${Date.now()}\n\n`); } catch {}
    }, 15000);

    // Cleanup on disconnect
    req.raw.on("close", () => {
      clearInterval(ping);
      unsub();
    });

    // Important: return the raw stream
    return reply;
  });
}
