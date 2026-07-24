import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import Busboy from "busboy";
import {
  brand,
  faqItems,
  packages,
  projects,
  serviceAreas,
  testimonialsPolicy
} from "../src/content.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const dataDir = path.join(root, "data");
const uploadsDir = path.join(dataDir, "uploads");
const leadsFile = path.join(dataDir, "leads.jsonl");
const notificationsFile = path.join(dataDir, "notifications.jsonl");
const cmsFile = path.join(dataDir, "cms-overrides.json");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
const adminToken = process.env.ATELIER_ADMIN_TOKEN || "dev-admin-token";
const editorToken = process.env.ATELIER_EDITOR_TOKEN || adminToken;
const rateBuckets = new Map();

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

if (!process.env.ATELIER_ADMIN_TOKEN) {
  console.warn("ATELIER_ADMIN_TOKEN is not set. Local admin token is dev-admin-token.");
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
  try {
    if (req.method === "POST" && url.pathname === "/api/leads") return handleLead(req, res);
    if (req.method === "GET" && url.pathname === "/api/admin/leads.csv") return handleLeadsCsv(req, res, url);
    if (req.method === "GET" && url.pathname.startsWith("/api/admin/uploads/")) return handleProtectedUpload(req, res, url);
    if (req.method === "GET" && url.pathname === "/api/admin/content") return handleContentGet(req, res, url);
    if (req.method === "POST" && url.pathname === "/api/admin/content") return handleContentPost(req, res, url);
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, url);
    json(res, 405, { ok: false, error: "method_not_allowed" });
  } catch (err) {
    console.error(err);
    json(res, 500, { ok: false, error: "server_error" });
  }
});

server.listen(port, host, () => {
  console.log(`ATELIER VERT local server: http://${host}:${port}/`);
  console.log(`Admin: http://${host}:${port}/admin/`);
});

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function tokenFrom(req, url) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return url.searchParams.get("token") || "";
}

function requireRole(req, res, url, roles) {
  const token = tokenFrom(req, url);
  if (roles.includes("admin") && token === adminToken) return "admin";
  if (roles.includes("editor") && token === editorToken) return "editor";
  json(res, 401, { ok: false, error: "unauthorized" });
  return null;
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0].trim();
}

function serverRateLimited(req) {
  const key = clientIp(req);
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const times = (rateBuckets.get(key) || []).filter((time) => now - time < hour);
  times.push(now);
  rateBuckets.set(key, times);
  return times.length > 5;
}

function validateLead(fields, files, fileErrors) {
  const errors = [];
  const required = ["communication_language", "name", "phone", "district", "area", "goals", "budget", "consent"];
  for (const key of required) {
    if (!present(fields[key])) errors.push(`${key}_required`);
  }
  const name = stringValue(fields.name);
  if (name && (name.length < 2 || name.length > 60)) errors.push("name_length");
  const phone = stringValue(fields.phone);
  if (phone && !/^\+?[0-9 ()-]{7,24}$/.test(phone)) errors.push("phone_format");
  const phoneDigits = phone.replace(/\D/g, "");
  if (phone && (phoneDigits.length < 7 || phoneDigits.length > 15)) errors.push("phone_format");
  const district = stringValue(fields.district);
  if (["netanya-other", "outside"].includes(district) && !present(fields.district_other)) {
    errors.push("district_other_required");
  }
  const floor = stringValue(fields.floor);
  if (floor && (Number(floor) < 0 || Number(floor) > 60)) errors.push("floor_range");
  if (files.length > 5) errors.push("too_many_photos");
  if (fileErrors.length) errors.push(...fileErrors.map((item) => item.error));
  return [...new Set(errors)];
}

function present(value) {
  return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && String(value).trim() !== "";
}

function stringValue(value) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

async function handleLead(req, res) {
  if (serverRateLimited(req)) return json(res, 429, { ok: false, error: "rate_limit" });
  if (!String(req.headers["content-type"] || "").includes("multipart/form-data")) {
    return json(res, 415, { ok: false, error: "multipart_required" });
  }

  const leadId = `lead_${new Date().toISOString().replace(/[-:.TZ]/g, "")}_${crypto.randomBytes(4).toString("hex")}`;
  const leadUploadDir = path.join(uploadsDir, leadId);
  const fields = {};
  const files = [];
  const fileErrors = [];
  const fileWrites = [];
  let photoCount = 0;

  const busboy = Busboy({
    headers: req.headers,
    limits: {
      files: 5,
      fileSize: 8 * 1024 * 1024,
      fieldSize: 10_000,
      fields: 60
    }
  });

  busboy.on("field", (name, value) => {
    if (name === "company") return;
    if (fields[name] !== undefined) {
      fields[name] = Array.isArray(fields[name]) ? [...fields[name], value] : [fields[name], value];
    } else {
      fields[name] = value;
    }
  });

  busboy.on("file", (fieldName, file, info) => {
    if (fieldName !== "photos" || !info.filename) {
      file.resume();
      return;
    }
    photoCount += 1;
    const original = path.basename(info.filename);
    const extension = path.extname(original).toLowerCase();
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);
    const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".heic"]);
    if (!allowedTypes.has(info.mimeType) && !allowedExtensions.has(extension)) {
      fileErrors.push({ error: "file_type", filename: original });
      file.resume();
      return;
    }
    fs.mkdirSync(leadUploadDir, { recursive: true });
    const safeName = `${String(photoCount).padStart(2, "0")}-${crypto.randomBytes(3).toString("hex")}-${sanitizeFileName(original)}`;
    const target = path.join(leadUploadDir, safeName);
    let limited = false;
    let size = 0;
    const stream = fs.createWriteStream(target, { flags: "wx" });
    file.on("data", (chunk) => {
      size += chunk.length;
    });
    file.on("limit", () => {
      limited = true;
      fileErrors.push({ error: "too_large", filename: original });
    });
    file.pipe(stream);
    fileWrites.push(new Promise((resolve) => {
      stream.on("finish", () => {
        if (limited) {
          fs.rmSync(target, { force: true });
        } else {
          files.push({
            filename: safeName,
            original_name: original,
            mime_type: info.mimeType || extension.slice(1),
            size,
            protected_path: `/api/admin/uploads/${leadId}/${encodeURIComponent(safeName)}`
          });
        }
        resolve();
      });
      stream.on("error", (err) => {
        fileErrors.push({ error: "upload_write_failed", filename: original, detail: err.message });
        file.resume();
        resolve();
      });
    }));
  });

  busboy.on("filesLimit", () => {
    fileErrors.push({ error: "too_many_photos" });
  });

  busboy.on("error", () => {
    json(res, 400, { ok: false, error: "multipart_parse_failed" });
  });

  busboy.on("close", async () => {
    await Promise.all(fileWrites);
    const errors = validateLead(fields, files, fileErrors);
    if (errors.length) {
      fs.rmSync(leadUploadDir, { recursive: true, force: true });
      return json(res, 400, { ok: false, error: "validation_failed", errors });
    }
    const lead = buildLeadRecord(leadId, fields, files);
    fs.appendFileSync(leadsFile, `${JSON.stringify(lead)}\n`);
    fs.mkdirSync(path.join(dataDir, "leads"), { recursive: true });
    fs.writeFileSync(path.join(dataDir, "leads", `${leadId}.json`), JSON.stringify(lead, null, 2));
    await notifyOwner(lead);
    json(res, 201, { ok: true, lead_id: leadId, next: lead.language === "he" ? "/he/thank-you/" : "/ru/thank-you/" });
  });

  req.pipe(busboy);
}

function buildLeadRecord(id, fields, files) {
  const language = stringValue(fields.page_language || fields.communication_language || "he");
  const utm = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    if (present(fields[key])) utm[key] = stringValue(fields[key]);
  }
  return {
    id,
    timestamp: new Date().toISOString(),
    language,
    contact: {
      name: stringValue(fields.name),
      phone: stringValue(fields.phone)
    },
    answers: {
      communication_language: stringValue(fields.communication_language),
      district: stringValue(fields.district),
      district_other: stringValue(fields.district_other),
      area: stringValue(fields.area),
      floor: stringValue(fields.floor),
      sun: stringValue(fields.sun),
      goals: Array.isArray(fields.goals) ? fields.goals : [stringValue(fields.goals)].filter(Boolean),
      budget: stringValue(fields.budget),
      package: stringValue(fields.package),
      comment: stringValue(fields.comment)
    },
    photos: files,
    utm,
    referrer: stringValue(fields.referrer),
    landing_page: stringValue(fields.landing_page),
    source_page: stringValue(fields.source_page),
    consent: present(fields.consent),
    status: "New",
    owner: null
  };
}

async function notifyOwner(lead) {
  const notification = {
    id: lead.id,
    timestamp: lead.timestamp,
    language: lead.language,
    contact: lead.contact,
    district: lead.answers.district,
    budget: lead.answers.budget,
    package: lead.answers.package,
    photo_count: lead.photos.length,
    protected_files: lead.photos.map((photo) => photo.protected_path)
  };
  fs.appendFileSync(notificationsFile, `${JSON.stringify(notification)}\n`);
  if (!process.env.ATELIER_LEAD_WEBHOOK_URL) return;
  try {
    await fetch(process.env.ATELIER_LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification)
    });
  } catch (err) {
    fs.appendFileSync(notificationsFile, `${JSON.stringify({ id: lead.id, webhook_error: err.message })}\n`);
  }
}

function sanitizeFileName(name) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "photo";
}

function handleLeadsCsv(req, res, url) {
  if (!requireRole(req, res, url, ["admin"])) return;
  const leads = readJsonLines(leadsFile);
  const headers = [
    "id",
    "timestamp",
    "status",
    "language",
    "name",
    "phone",
    "district",
    "area",
    "floor",
    "sun",
    "goals",
    "budget",
    "package",
    "photo_count",
    "protected_photo_paths",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "referrer",
    "landing_page",
    "consent"
  ];
  const rows = leads.map((lead) => ({
    id: lead.id,
    timestamp: lead.timestamp,
    status: lead.status,
    language: lead.language,
    name: lead.contact?.name,
    phone: lead.contact?.phone,
    district: lead.answers?.district,
    area: lead.answers?.area,
    floor: lead.answers?.floor,
    sun: lead.answers?.sun,
    goals: (lead.answers?.goals || []).join("|"),
    budget: lead.answers?.budget,
    package: lead.answers?.package,
    photo_count: lead.photos?.length || 0,
    protected_photo_paths: (lead.photos || []).map((photo) => photo.protected_path).join("|"),
    utm_source: lead.utm?.utm_source,
    utm_medium: lead.utm?.utm_medium,
    utm_campaign: lead.utm?.utm_campaign,
    utm_content: lead.utm?.utm_content,
    utm_term: lead.utm?.utm_term,
    referrer: lead.referrer,
    landing_page: lead.landing_page,
    consent: lead.consent
  }));
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=\"atelier-vert-leads.csv\"",
    "Cache-Control": "no-store"
  });
  res.end(csv);
}

function handleProtectedUpload(req, res, url) {
  if (!requireRole(req, res, url, ["admin"])) return;
  const parts = url.pathname.split("/").filter(Boolean);
  const leadId = parts[3];
  const filename = decodeURIComponent(parts.slice(4).join("/"));
  if (!/^lead_[a-zA-Z0-9_]+$/.test(leadId || "") || filename.includes("/") || filename.includes("..")) {
    return json(res, 400, { ok: false, error: "bad_upload_path" });
  }
  const filePath = path.join(uploadsDir, leadId, filename);
  if (!filePath.startsWith(uploadsDir) || !fs.existsSync(filePath)) {
    return json(res, 404, { ok: false, error: "not_found" });
  }
  res.writeHead(200, {
    "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filename.replaceAll('"', "")}"`,
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

function handleContentGet(req, res, url) {
  if (!requireRole(req, res, url, ["admin", "editor"])) return;
  json(res, 200, { ok: true, content: currentContent() });
}

async function handleContentPost(req, res, url) {
  if (!requireRole(req, res, url, ["admin", "editor"])) return;
  const payload = await readBodyJson(req, 2 * 1024 * 1024);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json(res, 400, { ok: false, error: "content_object_required" });
  }
  const allowed = ["brand", "packages", "faqItems", "projects", "serviceAreas", "testimonialsPolicy"];
  const clean = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) clean[key] = payload[key];
  }
  fs.writeFileSync(cmsFile, JSON.stringify(clean, null, 2));
  const build = spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: root, encoding: "utf8" });
  if (build.status !== 0) {
    return json(res, 500, { ok: false, error: "rebuild_failed", stderr: build.stderr });
  }
  json(res, 200, { ok: true, message: "Content saved and site rebuilt.", edited: Object.keys(clean) });
}

function currentContent() {
  return deepMerge({
    brand,
    packages,
    faqItems,
    projects,
    serviceAreas,
    testimonialsPolicy
  }, readCms());
}

function readCms() {
  if (!fs.existsSync(cmsFile)) return {};
  return JSON.parse(fs.readFileSync(cmsFile, "utf8"));
}

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  if (!base || typeof base !== "object" || !override || typeof override !== "object") return override ?? base;
  const merged = JSON.parse(JSON.stringify(base));
  for (const [key, value] of Object.entries(override)) {
    merged[key] = deepMerge(base[key], value);
  }
  return merged;
}

function readBodyJson(req, limit) {
  return new Promise((resolve) => {
    let size = 0;
    let body = "";
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        resolve(null);
      } else {
        body += chunk;
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function csvCell(value) {
  const textValue = value === undefined || value === null ? "" : String(value);
  return `"${textValue.replaceAll('"', '""')}"`;
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  let filePath = path.join(dist, pathname);
  if (!filePath.startsWith(dist)) return text(res, 403, "Forbidden");
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath = path.join(filePath, "index.html");
  }
  if (!filePath.startsWith(dist) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return text(res, 404, "Not found");
  }
  const contentType = mime[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": contentType.startsWith("text/html") ? "no-store" : "public, max-age=31536000, immutable"
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
}
