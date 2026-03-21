const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

function getLogDir(defaultDir) {
  return process.env.CHAT_LOG_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || defaultDir;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function appendJsonLine(filePath, payload) {
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function readJsonLines(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    return fs
      .readFileSync(filePath, "utf-8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function extractIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || req.ip || "unknown";
}

function detectDeviceType(userAgent = "") {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}

function detectBrowser(userAgent = "") {
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) return "Chrome";
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return "Safari";
  if (/firefox\//i.test(userAgent)) return "Firefox";
  return "Unknown";
}

function detectOS(userAgent = "") {
  if (/windows/i.test(userAgent)) return "Windows";
  if (/mac os x|macintosh/i.test(userAgent)) return "macOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ios/i.test(userAgent)) return "iOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Unknown";
}

function normalizeLanguage(languageHeader = "") {
  const primary = languageHeader.split(",")[0]?.split(";")[0]?.trim();
  if (!primary) return null;
  try {
    const display = new Intl.DisplayNames(["en"], { type: "language" });
    const language = primary.split("-")[0];
    const label = display.of(language);
    if (!label) return primary;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return primary;
  }
}

function extractLocation(req) {
  const city = req.headers["x-vercel-ip-city"] || req.headers["cf-ipcity"] || req.headers["x-city"] || null;
  const region =
    req.headers["x-vercel-ip-country-region"] ||
    req.headers["x-region"] ||
    req.headers["cf-region"] ||
    null;
  const country = req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || req.headers["x-country"] || null;
  return {
    city: typeof city === "string" && city.trim() ? city.trim() : null,
    region: typeof region === "string" && region.trim() ? region.trim() : null,
    country: typeof country === "string" && country.trim() ? country.trim() : null,
  };
}

function getClientMetadata(req) {
  const userAgent = req.headers["user-agent"] || "";
  const pageUrl = req.body?.pageUrl || req.query?.pageUrl || null;
  const pageTitle = req.body?.pageTitle || req.query?.pageTitle || null;
  const location = extractLocation(req);
  const language = req.headers["accept-language"] || null;
  return {
    ip: extractIp(req),
    userAgent,
    referer: req.headers.referer || null,
    origin: req.headers.origin || null,
    language,
    languageLabel: normalizeLanguage(language || ""),
    deviceType: detectDeviceType(userAgent),
    browser: detectBrowser(userAgent),
    os: detectOS(userAgent),
    pageUrl,
    pageTitle,
    city: location.city,
    region: location.region,
    country: location.country,
  };
}

function getSessionRecord(sessionsPath, sessionId) {
  const sessions = readJson(sessionsPath, []);
  return sessions.find((entry) => entry.sessionId === sessionId) || null;
}

function upsertSessionRecord(sessionsPath, record) {
  const sessions = readJson(sessionsPath, []);
  const index = sessions.findIndex((entry) => entry.sessionId === record.sessionId);
  if (index >= 0) {
    sessions[index] = record;
  } else {
    sessions.push(record);
  }
  writeJson(sessionsPath, sessions);
}

function createAnalyticsStore(defaultDir) {
  const logDir = getLogDir(defaultDir);
  ensureDir(logDir);

  return {
    logDir,
    chatLogPath: path.join(logDir, "chat_logs.jsonl"),
    sessionPath: path.join(logDir, "chat_sessions.json"),
  };
}

function logChatEvent(store, payload) {
  appendJsonLine(store.chatLogPath, payload);
}

function buildSessionSnapshot(sessionId, sessionState, metadata) {
  const startedAt = sessionState.analytics?.startedAt || new Date().toISOString();
  const summary = sessionState.analytics?.interestSummary || null;
  const latestLead = sessionState.analytics?.latestLead || null;
  const leadStatus = sessionState.analytics?.leadStatus || "open";
  const adminNote = sessionState.analytics?.adminNote || "";
  const rawMessages = sessionState.analytics?.rawMessages || [];
  const lastUserMessage = [...rawMessages].reverse().find((entry) => entry.role === "user")?.text || null;

  return {
    sessionId,
    startedAt,
    lastSeenAt: new Date().toISOString(),
    messageCount: sessionState.messages.length,
    rawMessageCount: rawMessages.length,
    userMessageCount: rawMessages.filter((entry) => entry.role === "user").length,
    assistantMessageCount: rawMessages.filter((entry) => entry.role === "assistant").length,
    lastUserMessage,
    interestSummary: summary,
    topSourceTitles: sessionState.analytics?.topSourceTitles || [],
    metadata: {
      ip: metadata?.ip || sessionState.analytics?.metadata?.ip || "unknown",
      deviceType: metadata?.deviceType || sessionState.analytics?.metadata?.deviceType || "unknown",
      browser: metadata?.browser || sessionState.analytics?.metadata?.browser || "Unknown",
      os: metadata?.os || sessionState.analytics?.metadata?.os || "Unknown",
      language: metadata?.language || sessionState.analytics?.metadata?.language || null,
      languageLabel: metadata?.languageLabel || sessionState.analytics?.metadata?.languageLabel || null,
      referer: metadata?.referer || sessionState.analytics?.metadata?.referer || null,
      origin: metadata?.origin || sessionState.analytics?.metadata?.origin || null,
      pageUrl: metadata?.pageUrl || sessionState.analytics?.metadata?.pageUrl || null,
      pageTitle: metadata?.pageTitle || sessionState.analytics?.metadata?.pageTitle || null,
      city: metadata?.city || sessionState.analytics?.metadata?.city || null,
      region: metadata?.region || sessionState.analytics?.metadata?.region || null,
      country: metadata?.country || sessionState.analytics?.metadata?.country || null,
      userAgent: metadata?.userAgent || sessionState.analytics?.metadata?.userAgent || "",
    },
    latestLead,
    leadStatus,
    adminNote,
    recentMessages: rawMessages.slice(-12),
  };
}

function persistSessionSnapshot(store, sessionId, sessionState, metadata) {
  upsertSessionRecord(store.sessionPath, buildSessionSnapshot(sessionId, sessionState, metadata));
}

function cleanupJson(text) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function summarizeInterest({ apiKey, sessionState }) {
  if (!apiKey) return null;
  const userMessages = (sessionState.analytics?.rawMessages || [])
    .filter((entry) => entry.role === "user")
    .slice(-8)
    .map((entry) => entry.text);

  if (!userMessages.length) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const prompt = `
Summarize this chatbot visitor for internal sales/content analytics.
Return JSON only with this exact shape:
{
  "interest_summary": "1-2 sentence plain English summary",
  "interest_category": "one short label",
  "buying_stage": "awareness|research|quote-ready|support|unknown",
  "topics": ["topic 1", "topic 2", "topic 3"],
  "sentiment": "positive|neutral|frustrated|urgent|unknown",
  "lead_temperature": "cold|warm|hot",
  "recommended_follow_up": "one short internal sales/content action"
}

Recent user messages:
${userMessages.map((message, index) => `${index + 1}. ${message}`).join("\n")}
`.trim();

  const response = await model.generateContent(prompt);
  const text = response.response.text?.() || "";
  const cleaned = cleanupJson(text);
  return JSON.parse(cleaned);
}

module.exports = {
  createAnalyticsStore,
  getClientMetadata,
  getSessionRecord,
  logChatEvent,
  persistSessionSnapshot,
  readJson,
  readJsonLines,
  summarizeInterest,
};
