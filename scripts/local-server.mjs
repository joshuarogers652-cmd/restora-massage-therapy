// ───────────────────────────────────────────────────────────────────────────
// RESTORA local development server — FOR LOCAL DEVELOPMENT AND TESTING ONLY.
//
// Serves the built website (dist/) and the compiled Azure Functions API
// (api/dist/) on one port, and imitates Azure Static Web Apps sign-in
// (/.auth/login, /.auth/me, /.auth/logout) with a simple "pick an email" form.
// Nothing in this file is deployed to Azure; in Azure, real sign-in and the
// real Functions host take its place.
//
//   npm run build && npm run build:api && npm run local
// ───────────────────────────────────────────────────────────────────────────
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "api", "package.json"));

// Load .env.local (simple KEY=VALUE lines) for DATABASE_URL, ADMIN_EMAILS, etc.
for (const file of [".env.local", "api/.env.local"]) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.DATA_ENCRYPTION_KEY) {
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  console.warn("! No DATA_ENCRYPTION_KEY set: using a temporary key. Encrypted test data won't be readable after a restart.");
}

const { HttpRequest, InvocationContext } = require("@azure/functions");
require(path.join(root, "api/dist/src/index.js"));
const { registry, wrap } = require(path.join(root, "api/dist/src/http.js"));

const PORT = Number(process.env.LOCAL_PORT ?? 4280);
const DIST = path.join(root, "dist");
const SECRET = crypto.randomBytes(32);

const routes = registry.map((def) => {
  const names = [];
  const pattern = def.route.replace(/\{(\w+)\}/g, (_, n) => (names.push(n), "([^/]+)"));
  return { def, handler: wrap(def), names, regex: new RegExp(`^/api/${pattern}$`) };
});

// ─── signed session cookie that holds the fake principal ───
function sign(value) {
  const data = Buffer.from(JSON.stringify(value)).toString("base64url");
  const mac = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${mac}`;
}
function unsign(token) {
  if (!token) return null;
  const [data, mac] = token.split(".");
  const expect = crypto.createHmac("sha256", SECRET).update(data ?? "").digest("base64url");
  if (!mac || mac.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  return JSON.parse(Buffer.from(data, "base64url").toString());
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie ?? "").split(";").map((c) => c.trim().split("=").map(decodeURIComponent)).filter((x) => x[0]));
}
function principalFor(req) {
  return unsign(cookies(req).StaticWebAppsAuthCookie);
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const loginPage = (redirect) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Local sign-in</title><style>body{font-family:system-ui;background:#F8F4FB;color:#33313A;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#fff;padding:28px;border-radius:16px;box-shadow:0 8px 24px rgba(84,38,111,.12);width:min(92vw,380px)}
input,button{width:100%;box-sizing:border-box;font:inherit;padding:12px;border-radius:10px;border:1px solid #E6DCEF;margin-top:8px}
button{background:#54266F;color:#fff;border:0;font-weight:600;margin-top:16px;cursor:pointer}p{font-size:14px;color:#5F5A6B}</style></head>
<body><form method="post"><h1 style="margin:0 0 8px;font-size:20px;color:#54266F">Local development sign-in</h1>
<p>This page only exists on your computer. On Azure, people sign in with Microsoft.</p>
<label>Email<input name="email" type="email" required autofocus></label>
<input type="hidden" name="redirect" value="${redirect.replace(/"/g, "&quot;")}">
<button type="submit">Sign in</button></form></body></html>`;

async function handleAuth(req, res, url) {
  if (url.pathname === "/.auth/me") {
    const p = principalFor(req);
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ clientPrincipal: p ? { ...p, userRoles: ["anonymous", "authenticated"] } : null }));
  }
  if (url.pathname.startsWith("/.auth/login/")) {
    const redirect = url.searchParams.get("post_login_redirect_uri") ?? "/";
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(loginPage(redirect));
    }
    const form = new URLSearchParams((await readBody(req)).toString());
    const email = (form.get("email") ?? "").trim().toLowerCase();
    const target = (form.get("redirect") ?? "/").startsWith("/") ? form.get("redirect") : "/";
    if (!email.includes("@")) {
      res.writeHead(400);
      return res.end("Email required");
    }
    const principal = { identityProvider: "aad", userId: crypto.createHash("sha256").update(email).digest("hex").slice(0, 32), userDetails: email };
    res.writeHead(302, { Location: target, "Set-Cookie": `StaticWebAppsAuthCookie=${encodeURIComponent(sign(principal))}; Path=/; HttpOnly; SameSite=Lax` });
    return res.end();
  }
  if (url.pathname.startsWith("/.auth/logout")) {
    const redirect = url.searchParams.get("post_logout_redirect_uri") ?? "/";
    res.writeHead(302, { Location: redirect.startsWith("/") ? redirect : "/", "Set-Cookie": "StaticWebAppsAuthCookie=; Path=/; Max-Age=0" });
    return res.end();
  }
  res.writeHead(404);
  res.end();
}

async function handleApi(req, res, url) {
  const match = routes.map((r) => ({ r, m: url.pathname.match(r.regex) })).find((x) => x.m && x.r.def.methods.includes(req.method));
  if (!match) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: { code: "NOT_FOUND" } }));
  }
  const params = Object.fromEntries(match.r.names.map((n, i) => [n, decodeURIComponent(match.m[i + 1])]));
  const headers = { ...req.headers };
  delete headers["x-ms-client-principal"]; // like Azure: callers can't supply their own identity
  const principal = principalFor(req);
  if (principal) headers["x-ms-client-principal"] = Buffer.from(JSON.stringify({ ...principal, userRoles: ["anonymous", "authenticated"] })).toString("base64");
  headers["x-forwarded-for"] = req.socket.remoteAddress ?? "";
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : (await readBody(req)).toString("utf8");
  const request = new HttpRequest({
    method: req.method,
    url: `http://localhost:${PORT}${req.url}`,
    headers,
    params,
    query: Object.fromEntries(url.searchParams),
    body: body !== undefined ? { string: body } : undefined,
  });
  const result = await match.r.handler(request, new InvocationContext({ functionName: match.r.def.name }));
  res.writeHead(result.status ?? 200, result.headers ?? {});
  res.end(result.body ?? "");
}

function handleStatic(req, res, url) {
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) {
    res.writeHead(400);
    return res.end();
  }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
    return fs.createReadStream(file).pipe(res);
  }
  // Same rule as staticwebapp.config.json: files with an extension that don't exist are 404, not the app.
  if (path.extname(url.pathname)) {
    res.writeHead(404);
    return res.end("Not found");
  }
  file = path.join(DIST, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(500);
    return res.end("Run `npm run build` first.");
  }
  res.writeHead(200, { "Content-Type": MIME[".html"] });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    try {
      if (url.pathname.startsWith("/.auth/")) return await handleAuth(req, res, url);
      if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
      return handleStatic(req, res, url);
    } catch (err) {
      console.error(err);
      res.writeHead(500);
      res.end("Server error");
    }
  })
  .listen(PORT, () => console.log(`RESTORA local server (development only): http://localhost:${PORT}`));
