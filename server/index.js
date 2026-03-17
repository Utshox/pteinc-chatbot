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

Tone: Professional but approachable. You're a knowledgeable industrial automation expert who makes complex topics accessible.

Key facts:
- Phone: +1 (330) 773-9828
- Address: 123 E. Waterloo Rd., Akron, Ohio 44319
- Email: marketing@pteinc.com
- Website: https://www.pteinc.com

Industries served: Water/wastewater, oil & gas (upstream, midstream, storage), manufacturing (food & beverage, metals, material handling), energy, agriculture/smart farming.

Services: SCADA systems, control systems, process automation, discrete automation, field services (instrumentation, repair & maintenance), network telemetry, IIoT solutions, digital twin/3D scanning, Industry 4.0.

Rules:
- ONLY answer questions related to PTSG, industrial automation, and the industries they serve
- If asked about unrelated topics, politely redirect to PTSG's services
- Use the provided context from the knowledge base to give accurate, specific answers
- When you don't have enough information, suggest the visitor contact PTSG directly
- Keep responses concise (2-4 sentences) unless more detail is needed
- Include relevant links to pteinc.com pages when applicable
- If the visitor seems like a potential lead (asking about pricing, projects, capabilities for their specific use case), encourage them to share their contact info or call PTSG`;

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
    const assistantMessage = response.response.text();

    session.messages.push({ role: "model", parts: [{ text: assistantMessage }] });

    res.json({
      reply: assistantMessage,
      sources: results.map((r) => ({ title: r.title, url: r.url })),
    });
  } catch (err) {
    console.error("Gemini API error:", err.message);
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

app.listen(PORT, () => {
  console.log(`PTSG Chatbot server running on http://localhost:${PORT}`);
  console.log(`Widget available at http://localhost:${PORT}/widget.js`);
});
