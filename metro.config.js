const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const config = getDefaultConfig(__dirname);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
config.resolver.blockList = [
  new RegExp(escape(path.join(__dirname, "reference")) + "[/\\\\].*"),
  new RegExp(escape(path.join(__dirname, "package")) + "[/\\\\].*"),
  new RegExp(escape(path.join(__dirname, "dist")) + "[/\\\\].*"),
];
// Development browser preview only. Native devices connect directly to the VPS.
// Keep production CORS settings and the original web app unchanged.
config.maxWorkers = 2;
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  if (!req.url?.startsWith("/__pastq_api/api/"))
    return middleware(req, res, next);
  const origin = process.env.EXPO_PUBLIC_API_URL;
  if (!origin || !origin.startsWith("https://")) {
    res.writeHead(503);
    res.end("API not configured");
    return;
  }
  const target = new URL(req.url.slice("/__pastq_api".length), origin);
  const headers = { ...req.headers, host: target.host };
  delete headers.origin;
  delete headers.referer;
  delete headers.connection;
  const upstream = require("https").request(
    target,
    { method: req.method, headers },
    (reply) => {
      const responseHeaders = { ...reply.headers };
      delete responseHeaders["access-control-allow-origin"];
      res.writeHead(reply.statusCode, responseHeaders);
      reply.pipe(res);
    },
  );
  upstream.setTimeout(180000, () =>
    upstream.destroy(new Error("Request timed out")),
  );
  upstream.on("error", () => {
    if (!res.headersSent)
      res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Could not connect to the PastQ API." }));
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
};
module.exports = config;
