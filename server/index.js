require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Resend } = require("resend");
const { tokenize, tfidfVector, cosineSimilarity, STOPWORDS } = require("../scraper/embed");
const {
  createAnalyticsStore,
  geolocateIp,
  getClientMetadata,
  logChatEvent,
  persistSessionSnapshot,
  readJson,
  readJsonLines,
  summarizeInterest,
  writeJson,
} = require("./analytics");

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "andrew";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Load knowledge base
const DATA_DIR = path.join(__dirname, "..", "data");
const analyticsStore = createAnalyticsStore(DATA_DIR);
let chunks, index;

try {
  chunks = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "chunks.json"), "utf-8"));
  index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "index.json"), "utf-8"));
  console.log(`Loaded ${chunks.length} knowledge chunks`);
} catch (err) {
  console.error("Knowledge base not found. Run `npm run setup` first.");
  process.exit(1);
}

// Store conversation sessions (in-memory, use Redis for production)
const sessions = new Map();

const SYSTEM_PROMPT = `You are the AI assistant for Pro-Tech Systems Group (PTSG), an industrial automation and control systems integration company based in Akron, Ohio with 30+ years of experience.

Your role:
- Answer questions about PTSG's services, capabilities, and expertise
- Help potential clients understand how PTSG can solve their industrial automation challenges
- Be knowledgeable about SCADA, PLC, IIoT, control systems, process automation, 3D scanning, and related technologies
- Guide visitors toward contacting PTSG for detailed quotes or consultations
- Handle real-world customer scenarios: quote requests, pricing questions, technical troubleshooting, and project inquiries

Tone: Casual and human. Talk like a friendly coworker, not a corporate brochure. Short sentences. No fluff. Use "we" and "you" naturally. It's okay to be direct.

Key facts:
- Phone: +1 (330) 773-9828
- Address: 123 E. Waterloo Rd., Akron, Ohio 44319
- Email: marketing@pteinc.com
- Website: https://www.pteinc.com

Industries served: Water/wastewater, oil & gas (upstream, midstream, storage), manufacturing (food & beverage, metals, material handling), energy, agriculture/smart farming.

Services: SCADA systems, control systems, process automation, discrete automation, field services (instrumentation, repair & maintenance), network telemetry, IIoT solutions, digital twin/3D scanning, Industry 4.0.

Operational guidance from the team:
- Free site assessments and consultations: yes
- Pricing model: both fixed quote and time-and-materials depending on the job
- PLC brands supported: everything; we are an open architecture firm
- SCADA platforms supported: everything; we are an open architecture firm
- Typical timeline: depends on scope; small projects can move very quickly, larger projects take much longer
- Emergency support: yes, 24/7, with immediate response when a call comes in
- Service area: mainly Ohio and surrounding states, but we also complete projects in places like New York, Florida, Connecticut, and Michigan
- Differentiator: open architecture approach rather than being locked into one PLC or software brand
- Engineering team size: 5 engineers
- Remote monitoring/support for existing systems: yes
- SCADA cybersecurity work: yes
- Integration with existing third-party equipment: yes
- Industries to avoid overselling: packaging and textile are not core experience areas
- For accurate quotes, ask for: pictures of the current system/equipment, budget, timeline, location, contact information, and any job-specific details
- Preferred hot lead routing: sales department. Andrew Dolan at +1 (330) 773-9828 ext. 122 or Chris Viar at +1 (330) 773-9828 ext. 113
- Bulk water fill station pricing can vary based on what is already installed; rough projects may land around $10k-$40k, but only mention this as a very rough context point and always clarify that existing equipment changes the scope heavily

How to handle specific question types:

1. QUOTE REQUESTS (e.g. "Can you quote me a pump station panel?", "How much for a control panel?"):
   - Acknowledge the request enthusiastically — PTSG absolutely does this work
   - Explain that pricing depends on the specific requirements (number of pumps, VFDs vs starters, level sensors, telemetry needs, indoor/outdoor enclosure, etc.)
   - Ask 2-3 clarifying questions to show expertise (e.g. "How many pumps? Do you need VFD control or across-the-line starters? Will this need SCADA/telemetry integration?")
   - Offer to connect them with an engineer for a detailed quote
   - Mention they can call +1 (330) 773-9828 or email marketing@pteinc.com

2. PRICING QUESTIONS (e.g. "How much does a bulk water fill station cost?", "What's the cost of a SCADA upgrade?"):
   - Never make up prices or give specific dollar amounts
   - Explain that PTSG builds custom solutions and pricing varies based on scope
   - Give helpful context about what factors affect cost (size, complexity, integration requirements, site conditions)
   - Share what PTSG's solution typically includes so they understand the value
   - Push toward a free consultation or site assessment
   - For bulk water fill stations only, you may mention that rough projects can sometimes fall around $10k-$40k when existing equipment is already in place, but be very explicit that this is a rough context point and not a quote

3. TECHNICAL TROUBLESHOOTING (e.g. "Can you diagnose an alarm issue with my PLC?", "My SCADA system keeps losing communication"):
   - Take the question seriously — show you understand the urgency of equipment issues
   - Ask smart diagnostic questions (What PLC brand/model? What alarm code? When did it start? Any recent changes?)
   - Offer general troubleshooting guidance based on common issues
   - Recommend PTSG's field services team for hands-on diagnosis
   - Mention PTSG offers 24/7 support, repair & maintenance, and instrumentation services
   - Link to relevant service pages

4. PROJECT INQUIRIES (e.g. "We need to upgrade our water plant controls", "Looking for a SCADA integrator"):
   - Show genuine interest and ask about the scope
   - Reference PTSG's 30+ years of experience and relevant case studies
   - Ask about timeline, current systems, and specific pain points
   - Offer a free consultation or site visit

CRITICAL RULES:
- Keep replies SHORT — 2-3 sentences max. No walls of text. No bullet point lists unless absolutely needed.
- Talk like a real person. Say "Yeah, we do that!" not "Absolutely, Pro-Tech Systems Group offers comprehensive..."
- Don't repeat the company's full name over and over. Just say "we" or "our team".
- One follow-up question max, not a list of 3-4 questions
- Only answer questions related to PTSG, industrial automation, and their industries
- If asked about unrelated topics, keep it light and redirect
- Use the knowledge base context for accurate answers
- Include a relevant pteinc.com link when it makes sense, but don't force it
- Never make up prices — just say "depends on the setup" and offer to connect them with our team`;

// Lazy Gemini init — reads key at request time, not startup
function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    systemInstruction: SYSTEM_PROMPT,
  });
}

function searchKnowledgeBase(query, topK = 5) {
  const queryVec = tfidfVector(query, index.vocab, index.totalDocs, index.df);
  const scores = index.vectors.map((vec, i) => ({
    index: i,
    score: cosineSimilarity(queryVec, vec),
  }));

  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, topK).filter((s) => s.score > 0.05).map((s) => ({
    content: chunks[s.index].content,
    title: chunks[s.index].title,
    url: chunks[s.index].url,
    score: s.score,
  }));
}

function selectDisplaySources(results, maxSources = 2) {
  const seen = new Set();
  return results.filter((result) => {
    if (seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  }).slice(0, maxSources);
}

function createSessionState(metadata) {
  return {
    messages: [],
    leadInfo: null,
    analytics: {
      startedAt: new Date().toISOString(),
      metadata,
      rawMessages: [],
      topSourceTitles: [],
      interestSummary: null,
      latestLead: null,
      leadStatus: "open",
      adminNote: "",
    },
  };
}

function recordRawMessage(session, role, text) {
  session.analytics.rawMessages.push({
    role,
    text,
    timestamp: new Date().toISOString(),
  });
}

function queueInterestSummary(sessionId, session, metadata) {
  summarizeInterest({
    apiKey: process.env.GEMINI_API_KEY,
    sessionState: session,
  })
    .then((summary) => {
      if (!summary) return;
      session.analytics.interestSummary = summary;
      persistSessionSnapshot(analyticsStore, sessionId, session, metadata);
    })
    .catch((err) => {
      console.error("Interest summary error:", err.message);
    });
}

function summarizeSessions(sessionSnapshots) {
  const sessions = sessionSnapshots.slice().sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
  const totalSessions = sessions.length;
  const totalMessages = sessions.reduce((sum, session) => sum + (session.rawMessageCount || 0), 0);
  const leads = sessions.filter((session) => session.latestLead).length;
  const hotLeads = sessions.filter((session) => session.interestSummary?.lead_temperature === "hot").length;
  const stages = sessions.reduce((acc, session) => {
    const stage = session.interestSummary?.buying_stage || "unknown";
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});
  const topicCounts = {};
  for (const session of sessions) {
    for (const topic of session.interestSummary?.topics || []) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  }

  return {
    overview: {
      totalSessions,
      totalMessages,
      leads,
      hotLeads,
      leadRate: totalSessions ? Number(((leads / totalSessions) * 100).toFixed(1)) : 0,
      buyingStages: stages,
      topTopics: Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([topic, count]) => ({ topic, count })),
    },
    sessions,
  };
}

function getAdminToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return req.query.token || req.headers["x-admin-token"] || "";
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return next();
  }

  const provided = getAdminToken(req);
  if (provided !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildAnalyticsCsv(sessionSnapshots) {
  const headers = [
    "sessionId",
    "startedAt",
    "lastSeenAt",
    "ip",
    "pageUrl",
    "pageTitle",
    "deviceType",
    "browser",
    "os",
    "buyingStage",
    "leadTemperature",
    "sentiment",
    "interestCategory",
    "interestSummary",
    "recommendedFollowUp",
    "topics",
    "leadName",
    "leadEmail",
    "leadPhone",
    "leadCompany",
    "leadMessage",
    "lastUserMessage",
    "messageCount",
  ];

  const rows = sessionSnapshots.map((session) => [
    session.sessionId,
    session.startedAt,
    session.lastSeenAt,
    session.metadata?.ip,
    session.metadata?.pageUrl,
    session.metadata?.pageTitle,
    session.metadata?.deviceType,
    session.metadata?.browser,
    session.metadata?.os,
    session.interestSummary?.buying_stage,
    session.interestSummary?.lead_temperature,
    session.interestSummary?.sentiment,
    session.interestSummary?.interest_category,
    session.interestSummary?.interest_summary,
    session.interestSummary?.recommended_follow_up,
    (session.interestSummary?.topics || []).join(" | "),
    session.latestLead?.name,
    session.latestLead?.email,
    session.latestLead?.phone,
    session.latestLead?.company,
    session.latestLead?.message,
    session.lastUserMessage,
    session.rawMessageCount,
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function rewriteJsonLines(filePath, entries) {
  const body = entries.length ? `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n` : "";
  fs.writeFileSync(filePath, body);
}

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message, sessionId } = req.body;
  const metadata = getClientMetadata(req);

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  // Get or create session
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, createSessionState(metadata));
    // Enrich with IP geolocation on first message (async, non-blocking)
    geolocateIp(metadata.ip).then((geo) => {
      if (geo && sessions.has(sessionId)) {
        const s = sessions.get(sessionId);
        Object.assign(s.analytics.metadata, geo);
      }
    });
  }
  const session = sessions.get(sessionId);
  session.analytics.metadata = { ...session.analytics.metadata, ...metadata };

  // Search knowledge base for relevant context
  const results = searchKnowledgeBase(message);
  const displaySources = selectDisplaySources(results);
  const context = results.length
    ? results
        .map((r) => `[Source: ${r.title} (${r.url})]\n${r.content}`)
        .join("\n\n---\n\n")
    : "No specific information found in the knowledge base for this query.";

  // Build messages with context
  const userMessage = `Context from PTSG knowledge base:\n${context}\n\n---\nUser question: ${message}`;

  session.messages.push({ role: "user", parts: [{ text: userMessage }] });
  recordRawMessage(session, "user", message);
  session.analytics.topSourceTitles = results.map((r) => r.title);
  logChatEvent(analyticsStore, {
    type: "chat_user_message",
    timestamp: new Date().toISOString(),
    sessionId,
    message,
    metadata,
    matchedSources: results.map((r) => ({
      title: r.title,
      url: r.url,
      score: Number(r.score.toFixed(4)),
    })),
  });
  persistSessionSnapshot(analyticsStore, sessionId, session, metadata);

  // Keep conversation history manageable (last 10 exchanges)
  const recentMessages = session.messages.slice(-20);

  try {
    const chat = getModel().startChat({
      history: recentMessages.slice(0, -1), // all except the latest user message
    });

    const lastMessage = recentMessages[recentMessages.length - 1].parts[0].text;
    const response = await chat.sendMessage(lastMessage);
    const candidate = response.response.candidates?.[0];
    const assistantMessage = candidate?.content?.parts?.[0]?.text
      || response.response.text?.()
      || "Hmm, that's a bit outside my wheelhouse! I'm here to help with industrial automation, SCADA, control systems, and related topics. What can I help you with?";

    session.messages.push({ role: "model", parts: [{ text: assistantMessage }] });
    recordRawMessage(session, "assistant", assistantMessage);
    logChatEvent(analyticsStore, {
      type: "chat_assistant_message",
      timestamp: new Date().toISOString(),
      sessionId,
      reply: assistantMessage,
      metadata,
    });
    persistSessionSnapshot(analyticsStore, sessionId, session, metadata);

    res.json({
      reply: assistantMessage,
      sources: displaySources.map((r) => ({ title: r.title, url: r.url })),
    });
    queueInterestSummary(sessionId, session, metadata);
  } catch (err) {
    console.error("Gemini API error:", err.message, err.stack);
    logChatEvent(analyticsStore, {
      type: "chat_error",
      timestamp: new Date().toISOString(),
      sessionId,
      message,
      metadata,
      error: err.message,
    });
    res.status(500).json({
      reply:
        "I'm having trouble connecting right now. Please call us at +1 (330) 773-9828 or email marketing@pteinc.com for immediate assistance.",
      sources: [],
    });
  }
});

// Lead capture endpoint
app.post("/api/lead", async (req, res) => {
  const { name, email, phone, company, message, sessionId } = req.body;
  const metadata = getClientMetadata(req);

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const lead = {
    name,
    email,
    phone,
    company,
    message,
    sessionId,
    timestamp: new Date().toISOString(),
    chatHistory: sessions.has(sessionId)
      ? sessions.get(sessionId).messages.slice(-10)
      : [],
  };

  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.analytics.latestLead = {
      name: name || null,
      email,
      phone: phone || null,
      company: company || null,
      message: message || null,
      capturedAt: lead.timestamp,
    };
    persistSessionSnapshot(analyticsStore, sessionId, session, metadata);
  }

  const sessionSummary = sessions.has(sessionId)
    ? sessions.get(sessionId).analytics?.interestSummary || null
    : null;

  // Save lead to file (use a database in production)
  const leadsPath = path.join(DATA_DIR, "leads.json");
  let leads = [];
  if (fs.existsSync(leadsPath)) {
    leads = JSON.parse(fs.readFileSync(leadsPath, "utf-8"));
  }
  leads.push(lead);
  fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2));

  console.log(`New lead captured: ${email}`);
  logChatEvent(analyticsStore, {
    type: "lead_submitted",
    timestamp: lead.timestamp,
    sessionId,
    metadata,
    lead: {
      name: name || null,
      email,
      phone: phone || null,
      company: company || null,
      message: message || null,
    },
  });

  // Email the lead to the team
  const resendKey = process.env.RESEND_API_KEY;
  console.log(`Resend key: ${resendKey ? "yes (" + resendKey.substring(0, 8) + "...)" : "MISSING"}`);
  if (resendKey) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const notifyEmail = process.env.LEAD_NOTIFY_EMAIL || "iah.utshox@gmail.com";
      await resend.emails.send({
        from: "PTSG Chatbot <onboarding@resend.dev>",
        to: notifyEmail,
        subject: `New PTSG Lead: ${name || "Unknown"} - ${company || "No company"}`,
        html: `
          <h2>New Lead from PTSG Chatbot</h2>
          <table style="border-collapse:collapse;width:100%;max-width:500px;">
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${name || "Not provided"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px;border-bottom:1px solid #eee;">${phone ? `<a href="tel:${phone}">${phone}</a>` : "Not provided"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Company</td><td style="padding:8px;border-bottom:1px solid #eee;">${company || "Not provided"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Message</td><td style="padding:8px;border-bottom:1px solid #eee;">${message || "Not provided"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Page</td><td style="padding:8px;border-bottom:1px solid #eee;">${metadata.pageUrl || "Unknown"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Interest</td><td style="padding:8px;border-bottom:1px solid #eee;">${sessionSummary?.interest_summary || "Not available yet"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Buying Stage</td><td style="padding:8px;border-bottom:1px solid #eee;">${sessionSummary?.buying_stage || "unknown"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Lead Temperature</td><td style="padding:8px;border-bottom:1px solid #eee;">${sessionSummary?.lead_temperature || "unknown"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Recommended Follow-Up</td><td style="padding:8px;border-bottom:1px solid #eee;">${sessionSummary?.recommended_follow_up || "Review conversation"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Topics</td><td style="padding:8px;border-bottom:1px solid #eee;">${(sessionSummary?.topics || []).join(", ") || "None"}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}</td></tr>
          </table>
          <p style="color:#888;font-size:12px;margin-top:16px;">Sent by PTSG AI Chatbot</p>
        `,
      });
      console.log(`Lead email sent to ${notifyEmail}`);
    } catch (emailErr) {
      console.error("Failed to send lead email:", emailErr.message);
    }
  }

  res.json({ success: true, message: "Thank you! Our team will reach out shortly." });
});

app.get("/api/admin/analytics", requireAdmin, (req, res) => {
  const sessionSnapshots = readJson(analyticsStore.sessionPath, []);
  res.json(summarizeSessions(sessionSnapshots));
});

app.get("/api/admin/analytics/export.csv", requireAdmin, (req, res) => {
  const sessionSnapshots = readJson(analyticsStore.sessionPath, []);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="ptsg-chat-analytics.csv"');
  res.send(buildAnalyticsCsv(sessionSnapshots));
});

app.get("/api/admin/analytics/:sessionId", requireAdmin, (req, res) => {
  const sessionSnapshots = readJson(analyticsStore.sessionPath, []);
  const session = sessionSnapshots.find((entry) => entry.sessionId === req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const events = readJsonLines(analyticsStore.chatLogPath)
    .filter((entry) => entry.sessionId === req.params.sessionId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  res.json({ session, events });
});

app.delete("/api/admin/analytics/:sessionId/lead", requireAdmin, (req, res) => {
  const sessionSnapshots = readJson(analyticsStore.sessionPath, []);
  const sessionIndex = sessionSnapshots.findIndex((entry) => entry.sessionId === req.params.sessionId);
  if (sessionIndex === -1) {
    return res.status(404).json({ error: "Session not found" });
  }

  sessionSnapshots[sessionIndex] = {
    ...sessionSnapshots[sessionIndex],
    latestLead: null,
  };
  writeJson(analyticsStore.sessionPath, sessionSnapshots);

  const logEntries = readJsonLines(analyticsStore.chatLogPath).filter((entry) => {
    return !(entry.sessionId === req.params.sessionId && entry.type === "lead_submitted");
  });
  rewriteJsonLines(analyticsStore.chatLogPath, logEntries);

  const leadsPath = path.join(DATA_DIR, "leads.json");
  const leads = readJson(leadsPath, []).filter((lead) => lead.sessionId !== req.params.sessionId);
  if (fs.existsSync(leadsPath) || leads.length) {
    fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2));
  }

  if (sessions.has(req.params.sessionId)) {
    const liveSession = sessions.get(req.params.sessionId);
    liveSession.analytics.latestLead = null;
    liveSession.analytics.leadStatus = "open";
  }

  res.json({ success: true });
});

app.patch("/api/admin/analytics/:sessionId", requireAdmin, (req, res) => {
  const { leadStatus, adminNote } = req.body || {};
  const sessionSnapshots = readJson(analyticsStore.sessionPath, []);
  const sessionIndex = sessionSnapshots.findIndex((entry) => entry.sessionId === req.params.sessionId);
  if (sessionIndex === -1) {
    return res.status(404).json({ error: "Session not found" });
  }

  const nextSession = {
    ...sessionSnapshots[sessionIndex],
    leadStatus: leadStatus ?? sessionSnapshots[sessionIndex].leadStatus ?? "open",
    adminNote: adminNote ?? sessionSnapshots[sessionIndex].adminNote ?? "",
  };
  sessionSnapshots[sessionIndex] = nextSession;
  writeJson(analyticsStore.sessionPath, sessionSnapshots);

  if (sessions.has(req.params.sessionId)) {
    const liveSession = sessions.get(req.params.sessionId);
    liveSession.analytics.leadStatus = nextSession.leadStatus;
    liveSession.analytics.adminNote = nextSession.adminNote;
  }

  res.json({ success: true, session: nextSession });
});

app.delete("/api/admin/analytics/:sessionId", requireAdmin, (req, res) => {
  const sessionSnapshots = readJson(analyticsStore.sessionPath, []);
  const remainingSessions = sessionSnapshots.filter((entry) => entry.sessionId !== req.params.sessionId);
  if (remainingSessions.length === sessionSnapshots.length) {
    return res.status(404).json({ error: "Session not found" });
  }

  writeJson(analyticsStore.sessionPath, remainingSessions);

  const logEntries = readJsonLines(analyticsStore.chatLogPath).filter((entry) => entry.sessionId !== req.params.sessionId);
  rewriteJsonLines(analyticsStore.chatLogPath, logEntries);

  const leadsPath = path.join(DATA_DIR, "leads.json");
  const leads = readJson(leadsPath, []).filter((lead) => lead.sessionId !== req.params.sessionId);
  if (fs.existsSync(leadsPath) || leads.length) {
    fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2));
  }

  sessions.delete(req.params.sessionId);
  res.json({ success: true });
});

// Health check
app.get("/api/health", (req, res) => {
  let sessionFileStatus = "missing";
  let sessionCount = 0;
  try {
    if (fs.existsSync(analyticsStore.sessionPath)) {
      const raw = fs.readFileSync(analyticsStore.sessionPath, "utf-8");
      const parsed = JSON.parse(raw);
      sessionFileStatus = "ok";
      sessionCount = parsed.length;
    }
  } catch (err) {
    sessionFileStatus = "corrupt: " + err.message;
  }
  res.json({
    status: "ok",
    chunks: chunks.length,
    logDir: analyticsStore.logDir,
    sessionFile: sessionFileStatus,
    sessionCount,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PTSG Chatbot server running on http://localhost:${PORT}`);
  console.log(`Widget available at http://localhost:${PORT}/widget.js`);
  const key = process.env.GEMINI_API_KEY;
  console.log(`Gemini API key loaded: ${key ? "yes (" + key.substring(0, 8) + "...)" : "NO - MISSING!"}`);
  const envKeys = Object.keys(process.env).filter(k => k.includes("GEMINI") || k.includes("gemini"));
  console.log(`Env vars matching GEMINI: ${envKeys.length ? envKeys.join(", ") : "none found"}`);
});
