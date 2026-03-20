# PTSG AI Chatbot — RAG-Powered Customer Assistant

A production-ready AI chatbot for [Pro-Tech Systems Group (PTSG)](https://pteinc.com) that answers visitor questions using real website content via **Retrieval-Augmented Generation (RAG)** powered by Google Gemini AI.

**Live:** Deployed on Railway and embedded on [pteinc.com](https://pteinc.com)

![Node.js](https://img.shields.io/badge/Node.js-22-green)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-blue)
![Status](https://img.shields.io/badge/Status-Live-brightgreen)

---

## Features

- **RAG-powered answers** — grounded in 102 scraped pages (1133 knowledge chunks) from pteinc.com
- **Smart handling** of quotes, pricing, PLC troubleshooting, and project inquiries
- **Lead capture form** — collects visitor info with email notification via Resend
- **Conversational memory** — maintains context across messages (client-side history)
- **Same-tab page persistence** — conversation stays visible when a visitor moves between pages in the same tab
- **Clickable contacts** — phone numbers (`tel:`) and emails (`mailto:`) are tappable
- **Start Over button** — reset conversation anytime
- **Greeting bubble** — pops up after 3s to engage visitors
- **Quick action buttons** — Get a Quote, Pricing Info, PLC Troubleshooting, SCADA Upgrade
- **Source citations** — shows the top 1-2 most relevant pages
- **Mobile responsive** — full-screen on phones, floating widget on desktop
- **Scroll isolation** — mouse wheel stays trapped inside the widget
- **Analytics dashboard** — protected internal view of visitors, leads, interests, and follow-up suggestions

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- [Google Gemini API key](https://aistudio.google.com/apikey)

### 1. Install & configure
```bash
npm install
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 2. Build the knowledge base
```bash
npm run setup
```
> Scrapes pteinc.com and builds the TF-IDF search index.

### 3. Start the server
```bash
npm start
# or for auto-reload:
npm run dev
```

### 4. Open the demo
Visit [http://localhost:3001](http://localhost:3001)

---

## Production Deployment (Railway)

The chatbot is deployed on Railway at `pteinc-chatbot-production.up.railway.app`.

### Environment Variables (Railway)

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `RESEND_API_KEY` | Resend.com API key for lead email notifications |
| `LEAD_NOTIFY_EMAIL` | Email address to receive lead notifications |
| `CHAT_LOG_DIR` | Persistent mounted path for chat logs and session snapshots, e.g. `/data` |
| `ADMIN_TOKEN` | Password/token for the analytics dashboard |

### WordPress Embed

Added to pteinc.com via WPCode plugin (Site Wide Footer):

```html
<script>window.PTSG_CHAT_API = "https://pteinc-chatbot-production.up.railway.app";</script>
<script src="https://pteinc-chatbot-production.up.railway.app/widget.js?v=20260321c"></script>
```

If WordPress or a CDN serves an older version after deploy, bump the `?v=` value and purge caches.

### Persistent Chat Data

For Railway, mount a volume at `/data` and set:

```bash
CHAT_LOG_DIR=/data
```

This keeps chat/session analytics across deploys instead of losing them with container rebuilds.

---

## Project Structure

```
pteinc/
├── api/                    # Serverless functions (Vercel-compatible)
│   ├── chat.js             # Chat endpoint (serverless version)
│   ├── lead.js             # Lead capture (serverless version)
│   └── health.js           # Health check
├── scraper/
│   ├── scrape.js           # Crawls pteinc.com sitemap, extracts text, chunks content
│   └── embed.js            # Builds TF-IDF vector index for similarity search
├── server/
│   └── index.js            # Express API — chat, lead capture, email notifications
├── public/
│   ├── index.html          # Demo page
│   └── widget.js           # Embeddable chat widget (vanilla JS, zero deps)
├── data/
│   ├── chunks.json         # Text chunks with metadata (1133 chunks)
│   └── index.json          # TF-IDF vector index (4018 terms)
├── Dockerfile              # Production container config
├── .env.example            # Environment template
└── package.json
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | RAG chat. Body: `{ message, sessionId, history }` |
| `POST` | `/api/lead` | Lead capture + email notification. Body: `{ name, email, phone, company, message, sessionId }` |
| `GET` | `/api/health` | Health check — returns chunk count |

---

## How It Works

1. **User sends a message** → widget sends to `/api/chat` with message + conversation history
2. **TF-IDF search** finds the top 5 most relevant knowledge chunks from scraped website content
3. **Gemini 2.5 Flash** generates a response using the retrieved context + system prompt
4. **Response** is returned with source citations
5. **Lead form** (triggered by "Talk to our team" button) sends lead info to `/api/lead`
6. **Email notification** is sent to the configured email via Resend

---

## Updating the Knowledge Base

When new content is added to pteinc.com:

```bash
npm run setup    # Re-scrape + rebuild index
git add data/chunks.json data/index.json
git commit -m "Update knowledge base"
git push         # Railway auto-deploys
```

---

## Next Steps

### Completed
- [x] RAG chatbot with Gemini AI
- [x] Website scraper + TF-IDF search
- [x] Lead capture with email notifications
- [x] Deployed on Railway
- [x] Embedded on pteinc.com (WordPress)
- [x] Greeting bubble + quick actions
- [x] Start Over / conversation reset
- [x] Clickable phone/email links
- [x] Mobile responsive + scroll isolation

### Phase 2 — Improvements
- [ ] Swap TF-IDF for real embeddings (OpenAI/Voyage) for better search quality
- [ ] Add vector database (Pinecone/Supabase pgvector) for scalable storage
- [ ] Streaming responses for real-time typing effect
- [ ] Analytics dashboard — popular questions, lead conversion rates
- [ ] Rate limiting to prevent API abuse
- [ ] Admin panel to view leads and chat logs
- [ ] Add custom knowledge (FAQs, pricing guides, case studies not on website)

### Phase 3 — Advanced
- [ ] Multi-language support
- [ ] Voice input (Web Speech API)
- [ ] CRM integration (HubSpot/Salesforce)
- [ ] A/B testing different system prompts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 + Express |
| AI | Google Gemini 2.5 Flash |
| Search | TF-IDF vectors + cosine similarity |
| Scraping | Cheerio + Axios |
| Email | Resend |
| Frontend | Vanilla JS widget (zero dependencies) |
| Hosting | Railway (Docker) |
| CMS | WordPress (pteinc.com) |

---

## Development Commands

```bash
npm run scrape    # Crawl pteinc.com and save to data/
npm run embed     # Build TF-IDF search index
npm run setup     # Run both scrape + embed
npm start         # Start production server
npm run dev       # Start with auto-reload (--watch)
```
