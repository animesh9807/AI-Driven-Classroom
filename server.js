 // optional, safe if dotenv not installed
require("dotenv").config({ quiet: true });
 const express = require("express");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 5050;
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const app = express();
app.use(express.json({ limit: "10mb" }));

// Serve frontend + uploaded PDFs
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".pdf")) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
    }
  }
}));

// API routes
app.use("/api/auth", require("./backend/routes/auth"));
app.use("/api/classroom", require("./backend/routes/classroom"));
app.use("/api/material", require("./backend/routes/material"));
app.use("/api/session", require("./backend/routes/session"));
app.use("/api/chat", require("./backend/routes/chat"));

// Fallback to index.html for any non-API route (SPA behavior)
app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log("🚀 Smart Classroom AI running at http://localhost:" + PORT);
});