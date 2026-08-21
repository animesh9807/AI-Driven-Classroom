// backend/services/pdfService.js
const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Cleans extracted PDF text to eliminate line-wrap artifacts,
 * page markers, hyphenated breaks, and stray symbols.
 */
function cleanExtractedText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  return rawText
    .replace(/\f/g, '\n')
    // Remove standalone page markers (e.g., "Page 1 of 12", "1 / 10", "- 5 -")
    .replace(/^\s*(?:page\s+)?(?:\d+\s*(?:\/|of)\s*\d+|\d+|-?\s*\d+\s*-?)\s*$/gim, '')
    // Rejoin words split across line breaks (e.g., "mo-\ntion" -> "motion")
    .replace(/(\b\w+)-\n(\w+\b)/g, '$1$2')
    // Normalize spaces and tabs
    .replace(/[ \t]+/g, ' ')
    // Normalize vertical spacing
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Splits document text into distinct conceptual/slide chunks based on headings,
 * numbered topics (e.g., "1. Introduction"), and logical section breaks.
 */
function chunkText(text, maxChunks = 25) {
  if (!text || typeof text !== 'string') return [];
  const clean = cleanExtractedText(text);
  if (!clean) return [];

  // Step 1: Detect explicit section breaks (e.g. "1. Introduction", "2. Forces", "Chapter 1", etc.)
  const sectionSplitPattern = /(?=\n\s*(?:\d+\.|\b(?:Section|Chapter|Topic|Part)\b|[A-Z0-9\s:]{4,}\n))/g;
  let rawSections = clean.split(sectionSplitPattern).map((s) => s.trim()).filter((s) => s.length > 40);

  // Step 2: If heading regex didn't find enough boundaries, fall back to paragraph groups
  if (rawSections.length < 2) {
    const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const assembled = [];
    let current = '';

    for (const para of paragraphs) {
      if ((current + '\n\n' + para).length > 800 && current.length > 100) {
        assembled.push(current.trim());
        current = para;
      } else {
        current = current ? current + '\n\n' + para : para;
      }
    }
    if (current.trim()) assembled.push(current.trim());
    rawSections = assembled;
  }

  // Step 3: Normalize chunk sizes (merge micro-chunks < 100 chars, split oversized chunks > 1800 chars)
  const normalizedChunks = [];
  let buffer = '';

  for (let i = 0; i < rawSections.length; i++) {
    const section = rawSections[i];

    if (section.length > 1800) {
      if (buffer.trim()) {
        normalizedChunks.push(buffer.trim());
        buffer = '';
      }
      // Split large single section into ~1000 char blocks
      let start = 0;
      while (start < section.length) {
        const slice = section.slice(start, start + 1000).trim();
        if (slice.length > 40) normalizedChunks.push(slice);
        start += 850; // 150 char overlap
      }
    } else if ((buffer + '\n\n' + section).length < 350 && i < rawSections.length - 1) {
      buffer = buffer ? buffer + '\n\n' + section : section;
    } else {
      const finalChunk = buffer ? buffer + '\n\n' + section : section;
      if (finalChunk.trim().length > 30) {
        normalizedChunks.push(finalChunk.trim());
      }
      buffer = '';
    }
  }

  if (buffer.trim()) {
    normalizedChunks.push(buffer.trim());
  }

  if (normalizedChunks.length === 0 && clean.length > 10) {
    normalizedChunks.push(clean.slice(0, 1200));
  }

  return normalizedChunks.slice(0, maxChunks);
}

/**
 * Extracts and cleans text from a PDF file.
 */
async function extractTextFromFile(filePath) {
  let dataBuffer;
  if (Buffer.isBuffer(filePath)) {
    dataBuffer = filePath;
  } else if (typeof filePath === 'string') {
    dataBuffer = fs.readFileSync(filePath);
  } else {
    throw new Error('Invalid file path or buffer passed to extractTextFromFile.');
  }

  const pdfData = await pdfParse(dataBuffer);
  const cleaned = cleanExtractedText(pdfData.text || '');

  return {
    text: cleaned,
    numPages: pdfData.numpages || 1,
  };
}

async function processPDF(source) {
  const extracted = await extractTextFromFile(source);
  const chunks = chunkText(extracted.text);
  return {
    rawText: extracted.text,
    cleanedText: extracted.text,
    chunks,
    numPages: extracted.numPages,
  };
}

module.exports = {
  extractTextFromFile,
  cleanExtractedText,
  chunkText,
  processPDF,
};