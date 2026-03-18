const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const { tokenize, tfidfVector, cosineSimilarity } = require("../scraper/embed.js");

// Load knowledge base
const DATA_DIR = path.join(__dirname, "..", "data");
const chunks = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "chunks.json"), "utf-8"));
const index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "index.json"), "utf-8"));

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

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, sessionId, history = [] } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  // Search knowledge base
  const results = searchKnowledgeBase(message);
  const context = results.length
    ? results.map((r) => `[Source: ${r.title} (${r.url})]\n${r.content}`).join("\n\n---\n\n")
    : "No specific information found in the knowledge base for this query.";

  const userMessage = `Context from PTSG knowledge base:\n${context}\n\n---\nUser question: ${message}`;

  // Build chat history from client (serverless = no server-side sessions)
  const chatHistory = history.slice(-18).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: SYSTEM_PROMPT,
    });

    const chat = model.startChat({ history: chatHistory });
    const response = await chat.sendMessage(userMessage);
    const candidate = response.response.candidates?.[0];
    const reply = candidate?.content?.parts?.[0]?.text
      || response.response.text?.()
      || "Hmm, that's a bit outside my wheelhouse! I'm here to help with industrial automation, SCADA, control systems, and related topics. What can I help you with?";

    res.json({
      reply,
      sources: results.map((r) => ({ title: r.title, url: r.url })),
    });
  } catch (err) {
    console.error("Gemini API error:", err.message);
    res.status(500).json({
      reply: "I'm having trouble connecting right now. Call us at +1 (330) 773-9828 or email marketing@pteinc.com.",
      sources: [],
    });
  }
};
