const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
  };

  // In serverless, write to /tmp (or use a database in production)
  const leadsPath = path.join("/tmp", "leads.json");
  let leads = [];
  try {
    if (fs.existsSync(leadsPath)) {
      leads = JSON.parse(fs.readFileSync(leadsPath, "utf-8"));
    }
  } catch {}
  leads.push(lead);
  fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2));

  console.log(`New lead captured: ${email}`);
  res.json({ success: true, message: "Thank you! Our team will reach out shortly." });
};
