// src/routes/listenerRoutes.js
function requireStreamer(req, reply) {
  const streamerId = req.session?.streamerId;
  if (!streamerId) {
    reply.code(401).send({ error: "Not authenticated" });
    return null;
  }
  return streamerId;
}

export async function registerListenerRoutes(app, { listenerService }) {
  // POST /admin/api/listener/start
  app.post("/admin/api/listener/start", async (req, reply) => {
    const streamerId = requireStreamer(req, reply);
    if (!streamerId) return;

    try {
      const out = await listenerService.start(streamerId);
      return reply.send(out);
    } catch (e) {
      return reply.code(500).send({ error: e.message || "start failed" });
    }
  });

  // POST /admin/api/listener/stop
  app.post("/admin/api/listener/stop", async (req, reply) => {
    const streamerId = requireStreamer(req, reply);
    if (!streamerId) return;

    try {
      const out = await listenerService.stop(streamerId);
      return reply.send(out);
    } catch (e) {
      return reply.code(500).send({ error: e.message || "stop failed" });
    }
  });

  // GET /admin/api/listener/status
  app.get("/admin/api/listener/status", async (req, reply) => {
    const streamerId = requireStreamer(req, reply);
    if (!streamerId) return;

    try {
      const out = await listenerService.status(streamerId);
      return reply.send(out);
    } catch (e) {
      return reply.code(500).send({ error: e.message || "status failed" });
    }
  });
}
