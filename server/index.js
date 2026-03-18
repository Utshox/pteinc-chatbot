require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { tokenize, tfidfVector, cosineSimilarity, STOPWORDS } = require("../scraper/embed");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Load knowledge base
const DATA_DIR = path.join(__dirname, "..", "data");
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

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: SYSTEM_PROMPT,
});

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

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  // Get or create session
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [], leadInfo: null });
  }
  const session = sessions.get(sessionId);

  // Search knowledge base for relevant context
  const results = searchKnowledgeBase(message);
  const context = results.length
    ? results
        .map((r) => `[Source: ${r.title} (${r.url})]\n${r.content}`)
        .join("\n\n---\n\n")
    : "No specific information found in the knowledge base for this query.";

  // Build messages with context
  const userMessage = `Context from PTSG knowledge base:\n${context}\n\n---\nUser question: ${message}`;

  session.messages.push({ role: "user", parts: [{ text: userMessage }] });

  // Keep conversation history manageable (last 10 exchanges)
  const recentMessages = session.messages.slice(-20);

  try {
    const chat = model.startChat({
      history: recentMessages.slice(0, -1), // all except the latest user message
    });

    const lastMessage = recentMessages[recentMessages.length - 1].parts[0].text;
    const response = await chat.sendMessage(lastMessage);
    const candidate = response.response.candidates?.[0];
    const assistantMessage = candidate?.content?.parts?.[0]?.text
      || response.response.text?.()
      || "Hmm, that's a bit outside my wheelhouse! I'm here to help with industrial automation, SCADA, control systems, and related topics. What can I help you with?";

    session.messages.push({ role: "model", parts: [{ text: assistantMessage }] });

    res.json({
      reply: assistantMessage,
      sources: results.map((r) => ({ title: r.title, url: r.url })),
    });
  } catch (err) {
    console.error("Gemini API error:", err.message, err.stack);
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

  // Save lead to file (use a database in production)
  const leadsPath = path.join(DATA_DIR, "leads.json");
  let leads = [];
  if (fs.existsSync(leadsPath)) {
    leads = JSON.parse(fs.readFileSync(leadsPath, "utf-8"));
  }
  leads.push(lead);
  fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2));

  console.log(`New lead captured: ${email}`);
  res.json({ success: true, message: "Thank you! Our team will reach out shortly." });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", chunks: chunks.length });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PTSG Chatbot server running on http://localhost:${PORT}`);
  console.log(`Widget available at http://localhost:${PORT}/widget.js`);
  const key = process.env.GEMINI_API_KEY;
  console.log(`Gemini API key loaded: ${key ? "yes (" + key.substring(0, 8) + "...)" : "NO - MISSING!"}`);
  const envKeys = Object.keys(process.env).filter(k => k.includes("GEMINI") || k.includes("gemini"));
  console.log(`Env vars matching GEMINI: ${envKeys.length ? envKeys.join(", ") : "none found"}`);
});
