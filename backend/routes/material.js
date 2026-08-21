// backend/routes/material.js
const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const { auth } = require("../middleware/auth");
const { db, persist, genId } = require("../utils/db");
const { extractTextFromFile, chunkText } = require("../services/pdfService");
const aiService = require("../services/aiService");
const visualLibrary = require("../services/visualLibrary");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Track active jobs to prevent duplicate execution
const activeProcessingJobs = new Set();

/**
 * Asynchronous background worker for heavy PDF extraction & AI generation.
 */
async function processMaterialInBackground(materialId, filePath) {
  if (activeProcessingJobs.has(materialId)) return;
  activeProcessingJobs.add(materialId);

  const material = db.materials.find((m) => m.id === materialId);
  if (!material) {
    activeProcessingJobs.delete(materialId);
    return;
  }

  try {
    console.log(`⚡ [Background Job] Starting extraction for material: ${material.title}`);
    material.status = "extracting";
    material.progress = 10;
    persist();

    // 1. Text Extraction
    const extracted = await extractTextFromFile(filePath);
    material.rawText = extracted.text;
    material.numPages = extracted.numPages || 1;
    material.status = "analyzing";
    material.progress = 25;
    persist();

    // 2. Chunking
    const rawChunks = chunkText(extracted.text, 25);
    console.log(`📄 [Background Job] Document split into ${rawChunks.length} chunks. Analyzing concepts...`);

    const safeAnalyzeChunk = typeof aiService.analyzeChunk === "function"
      ? aiService.analyzeChunk
      : async (text) => ({
          topic: "Lesson Concept",
          keywords: ["physics", "kinematics"],
          flashcards: { diagrams: [], animation: [], simulation: [] },
          quiz: [],
        });

    const safeResolveFlashcards = typeof visualLibrary.resolveFlashcards === "function"
      ? visualLibrary.resolveFlashcards
      : async (fc) => fc || { diagrams: [], animation: [], simulation: [] };

    const chunks = [];
    for (let i = 0; i < rawChunks.length; i++) {
      console.log(`  → [Background Job] Analyzing chunk ${i + 1}/${rawChunks.length}`);
      
      const analysis = await safeAnalyzeChunk(rawChunks[i]);
      const flashcards = await safeResolveFlashcards(analysis.flashcards);

      chunks.push({
        id: genId(),
        page: Math.floor(i / 3) + 1,
        text: rawChunks[i],
        topic: analysis.topic,
        keywords: analysis.keywords,
        flashcards,
        quiz: analysis.quiz || [],
      });

      // Update incremental progress
      material.chunks = [...chunks];
      material.progress = Math.min(90, 25 + Math.floor(((i + 1) / rawChunks.length) * 65));
      persist();

      if (aiService.HAS_AI && i < rawChunks.length - 1) {
        await sleep(800);
      }
    }

    material.status = "ready";
    material.progress = 100;
    material.error = null;
    persist();
    console.log(`✅ [Background Job] Processing complete for: ${material.title}`);
  } catch (err) {
    console.error(`❌ [Background Job Failed] for material ${materialId}:`, err);
    material.status = "error";
    material.error = err.message || "Failed to analyze document topics";
    persist();
  } finally {
    activeProcessingJobs.delete(materialId);
  }
}

/**
 * Instant Upload Route: Stores file, creates posts, and returns immediately.
 */
router.post("/upload/:classroomId", auth(["teacher"]), upload.single("pdf"), async (req, res) => {
  try {
    const classroomId = req.params.classroomId;
    if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

    const filePath = req.file.path;
    const fileUrl = "/uploads/" + path.basename(filePath);
    const materialId = genId();

    // 1. Initial Material Record (Immediately presentable)
    const material = {
      id: materialId,
      classroomId,
      title: req.body.title || req.file.originalname,
      fileUrl,
      rawText: "",
      numPages: 1,
      chunks: [],
      status: "processing", // "processing" | "extracting" | "analyzing" | "ready" | "error"
      progress: 5,
      error: null,
      createdAt: new Date().toISOString(),
    };
    db.materials.push(material);

    // 2. Class Stream Post (Immediately visible to students & teacher)
    const post = {
      id: genId(),
      classroomId,
      type: "material",
      title: "📄 New Material: " + material.title,
      materialId: material.id,
      fileUrl,
      createdAt: new Date().toISOString(),
    };
    db.posts.push(post);
    persist();

    // 3. Immediately respond so UI unblocks instantly
    res.json(material);

    // 4. Trigger asynchronous background worker without awaiting
    setImmediate(() => {
      processMaterialInBackground(materialId, filePath);
    });
  } catch (e) {
    console.error("Upload error:", e);
    res.status(500).json({ error: "Upload failed: " + e.message });
  }
});

/**
 * Status and Material Details endpoint with real-time polling support.
 */
router.get("/:id", auth(), (req, res) => {
  const m = db.materials.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: "Not found" });
  res.json(JSON.parse(JSON.stringify(m)));
});

/**
 * Retry endpoint for failed AI background jobs.
 */
router.post("/:id/retry", auth(["teacher"]), (req, res) => {
  const material = db.materials.find((x) => x.id === req.params.id);
  if (!material) return res.status(404).json({ error: "Material not found" });

  const fileName = path.basename(material.fileUrl);
  const filePath = path.join(UPLOAD_DIR, fileName);

  material.status = "processing";
  material.progress = 5;
  material.error = null;
  persist();

  setImmediate(() => {
    processMaterialInBackground(material.id, filePath);
  });

  res.json({ success: true, message: "Processing restarted in background", material });
});

module.exports = router;