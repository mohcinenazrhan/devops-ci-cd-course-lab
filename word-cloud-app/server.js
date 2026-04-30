const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8888;

app.use(cors());
app.use(express.json());

// Serve React static files in production
app.use(express.static(path.join(__dirname, "dist")));

// API: process text into word frequencies
app.post("/api/wordcloud", (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text is required" });
  }

  const words = parseText(text);
  res.json({ words });
});

// API: health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: process.env.APP_VERSION || "dev" });
});

// API: version
app.get("/api/version", (_req, res) => {
  res.json({ version: process.env.APP_VERSION || "dev" });
});

// Catch-all: serve React app
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

function parseText(text) {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
    "for", "of", "is", "it", "this", "that", "with", "as", "by",
    "from", "be", "are", "was", "were", "been", "has", "have", "had",
    "do", "does", "did", "will", "would", "could", "should", "may",
    "might", "i", "you", "he", "she", "we", "they", "me", "him",
    "her", "us", "them", "my", "your", "his", "its", "our", "their",
  ]);

  const counts = {};

  text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w))
    .forEach((word) => {
      counts[word] = (counts[word] || 0) + 1;
    });

  return Object.entries(counts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

// Export for testing
module.exports = { app, parseText };

// Start server only when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Word Cloud app listening on port ${PORT}`);
  });
}
