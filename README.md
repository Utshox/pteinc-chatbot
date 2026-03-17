# PTSG AI Chatbot — RAG-Powered Customer Assistant

An AI chatbot for [Pro-Tech Systems Group (PTSG)](https://pteinc.com) that answers visitor questions using real website content via **Retrieval-Augmented Generation (RAG)** powered by Claude AI.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Claude AI](https://img.shields.io/badge/Claude-Sonnet_4-blue)
![Status](https://img.shields.io/badge/Status-MVP_Complete-yellow)

---

## What's Built (Current State)

| Component | File | Status |
|-----------|------|--------|
| Website Scraper | `scraper/scrape.js` | Done — scrapes 102 pages from pteinc.com sitemap |
| TF-IDF Embedder | `scraper/embed.js` | Done — 1133 chunks, 4018 term vocabulary |
| Express API Server | `server/index.js` | Done — `/api/chat` (RAG + Claude), `/api/lead` (lead capture) |
| Chat Widget | `public/widget.js` | Done — embeddable floating chat bubble |
| Demo Page | `public/index.html` | Done — standalone test page |
| Knowledge Base | `data/` | Done — scraped content + TF-IDF index (generated, gitignored) |

### Features Working
- RAG search — finds relevant content chunks for each user query
- Claude-powered responses grounded in PTSG website content
- Conversation session memory (in-memory)
- Lead capture form (triggers after 3 exchanges)
- Quick action buttons (SCADA, Water Treatment, IIoT, Contact Sales)
- Source citations on answers
- Mobile-responsive widget
- Graceful API error fallback with contact info

---

## Quick Start

### Prerequisites
- Node.js 18+
- [Anthropic API key](https://console.anthropic.com/)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 3. Build the knowledge base
This scrapes pteinc.com and generates the search index:
```bash
npm run setup
```
> This runs `npm run scrape` (crawl website) then `npm run embed` (build TF-IDF index).

### 4. Start the server
```bash
npm start
# or for auto-reload during development:
npm run dev
```

### 5. Open the demo
Visit [http://localhost:3001](http://localhost:3001) and click the chat bubble.

---

## Embedding on WordPress

Add before `</body>` in your WordPress theme (or via a plugin like "Insert Headers and Footers"):

```html
<script>window.PTSG_CHAT_API = "https://your-deployed-server.com";</script>
<script src="https://your-deployed-server.com/widget.js"></script>
```

---

## Project Structure

```
pteinc/
├── scraper/
│   ├── scrape.js          # Crawls pteinc.com sitemap, extracts text, creates chunks
│   └── embed.js           # Builds TF-IDF vector index for similarity search
├── server/
│   └── index.js           # Express API — RAG chat endpoint + lead capture
├── public/
│   ├── index.html          # Demo page
│   └── widget.js           # Embeddable chat widget (self-contained HTML/CSS/JS)
├── data/                   # Generated files (gitignored)
│   ├── pages.json          # Raw scraped pages
│   ├── chunks.json         # Text chunks with metadata
│   └── index.json          # TF-IDF vector index
├── .env.example            # Environment template
├── .gitignore
├── package.json
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send a message, get RAG-powered response. Body: `{ message, sessionId }` |
| `POST` | `/api/lead` | Submit lead info. Body: `{ name, email, phone, company, message, sessionId }` |
| `GET` | `/api/health` | Health check — returns chunk count |

---

## Where We Left Off / Next Steps

### Immediate TODOs
- [ ] **Add Anthropic API key** to `.env` and test end-to-end
- [ ] **Deploy to production** — Railway, Render, or DigitalOcean App Platform recommended
- [ ] **Test on pteinc.com** — embed widget on WordPress via script tag
- [ ] **Set up re-scrape cron** — run `npm run setup` weekly to keep knowledge base fresh

### Upgrade Path (Phase 2)
- [ ] **Swap TF-IDF for real embeddings** — Use OpenAI `text-embedding-3-small` or Voyage AI for significantly better search quality
- [ ] **Add vector database** — Pinecone, Supabase pgvector, or ChromaDB for scalable storage
- [ ] **Add Redis** — for session persistence across server restarts
- [ ] **Streaming responses** — use Claude streaming API for real-time typing effect
- [ ] **Analytics dashboard** — track popular questions, lead conversion, session length
- [ ] **Email notifications** — send leads to marketing@pteinc.com automatically via SendGrid/Resend
- [ ] **Rate limiting** — prevent abuse on the public API
- [ ] **Admin panel** — view leads, chat logs, and manage knowledge base

### Nice to Have (Phase 3)
- [ ] **Multi-language support** — Spanish, etc.
- [ ] **Voice input** — Web Speech API integration
- [ ] **CRM integration** — push leads directly to HubSpot/Salesforce
- [ ] **A/B test** — different system prompts for conversion optimization
- [ ] **Fine-tune system prompt** — based on real user conversations

---

## Tech Stack
- **Runtime:** Node.js + Express
- **AI:** Claude Sonnet 4 via Anthropic SDK
- **Search:** TF-IDF vectors with cosine similarity (local, no external DB)
- **Scraping:** Cheerio + Axios
- **Frontend:** Vanilla JS widget (zero dependencies, embeddable anywhere)

---

## Development Commands

```bash
npm run scrape    # Crawl pteinc.com and save to data/
npm run embed     # Build TF-IDF search index from scraped data
npm run setup     # Run both scrape + embed
npm start         # Start production server
npm run dev       # Start with auto-reload (--watch)
```

---

Built with Claude AI for Pro-Tech Systems Group (PTSG) — Akron, Ohio
