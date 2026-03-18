const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  let chunkCount = 0;
  try {
    const chunks = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "chunks.json"), "utf-8"));
    chunkCount = chunks.length;
  } catch {}
  res.json({ status: "ok", chunks: chunkCount });
};
