/**
 * Lightweight TF-IDF vector embedding for RAG search.
 * No external API calls needed — runs 100% locally.
 * For production, swap this with OpenAI/Voyage embeddings + Pinecone/pgvector.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

// Common English stopwords
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "has", "have", "been", "some", "them",
  "than", "its", "over", "also", "that", "with", "this", "from", "they",
  "will", "each", "make", "like", "long", "look", "many", "more", "most",
  "only", "into", "very", "when", "what", "your", "how", "about", "which",
  "their", "there", "these", "those", "then", "would", "could", "should",
  "being", "other", "where", "after", "just", "such", "because", "between",
]);

function buildVocabulary(docs) {
  const df = {}; // document frequency
  const totalDocs = docs.length;

  for (const doc of docs) {
    const tokens = new Set(tokenize(doc));
    for (const token of tokens) {
      if (!STOPWORDS.has(token)) {
        df[token] = (df[token] || 0) + 1;
      }
    }
  }

  // Keep terms that appear in at least 2 docs but not more than 80% of docs
  const vocab = {};
  let idx = 0;
  for (const [term, freq] of Object.entries(df)) {
    if (freq >= 2 && freq < totalDocs * 0.8) {
      vocab[term] = idx++;
    }
  }
  return vocab;
}

function tfidfVector(text, vocab, totalDocs, df) {
  const tokens = tokenize(text);
  const tf = {};
  for (const t of tokens) {
    if (vocab[t] !== undefined) {
      tf[t] = (tf[t] || 0) + 1;
    }
  }

  // Sparse vector as {index: value}
  const vec = {};
  for (const [term, count] of Object.entries(tf)) {
    const tfScore = 1 + Math.log(count);
    const idfScore = Math.log(totalDocs / (df[term] || 1));
    vec[vocab[term]] = tfScore * idfScore;
  }
  return vec;
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const va = a[key] || 0;
    const vb = b[key] || 0;
    dotProduct += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function main() {
  const chunksPath = path.join(DATA_DIR, "chunks.json");
  if (!fs.existsSync(chunksPath)) {
    console.error("No chunks.json found. Run `npm run scrape` first.");
    process.exit(1);
  }

  const chunks = JSON.parse(fs.readFileSync(chunksPath, "utf-8"));
  console.log(`Processing ${chunks.length} chunks...`);

  const docs = chunks.map((c) => `${c.title} ${c.content}`);

  // Build vocabulary
  const vocab = buildVocabulary(docs);
  console.log(`Vocabulary size: ${Object.keys(vocab).length} terms`);

  // Calculate document frequencies
  const df = {};
  for (const doc of docs) {
    const tokens = new Set(tokenize(doc));
    for (const token of tokens) {
      if (vocab[token] !== undefined) {
        df[token] = (df[token] || 0) + 1;
      }
    }
  }

  // Generate TF-IDF vectors for all chunks
  const vectors = chunks.map((chunk, i) => {
    const vec = tfidfVector(`${chunk.title} ${chunk.content}`, vocab, docs.length, df);
    if (i % 50 === 0) console.log(`  Embedded ${i}/${chunks.length}`);
    return vec;
  });

  // Save the index
  const index = { vocab, df, totalDocs: docs.length, vectors };
  fs.writeFileSync(path.join(DATA_DIR, "index.json"), JSON.stringify(index));

  console.log(`\nEmbedding index saved to ${DATA_DIR}/index.json`);
  console.log("Ready! Run `npm start` to launch the chatbot server.");
}

module.exports = { tokenize, tfidfVector, cosineSimilarity, STOPWORDS };

// Only run main() when executed directly, not when imported
if (require.main === module) {
  main();
}
