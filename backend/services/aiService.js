// backend/services/aiService.js
const OpenAI = require('openai');

const HAS_AI = Boolean(process.env.GROQ_API_KEY);
let groq = null;

if (HAS_AI) {
  groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  console.log('✅ AI mode: ENABLED (Groq)');
} else {
  console.log('ℹ️ AI mode: HEURISTIC (no GROQ_API_KEY set).');
}

// Your active Groq model roster
const CANDIDATE_MODELS = [
  'openai/gpt-oss-120b',
  'groq/compound',
  'openai/gpt-oss-20b',
  'groq/compound-mini',
  'qwen/qwen3.6-27b'
];

let activeWorkingModel = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'it', 'that',
  'this', 'for', 'with', 'as', 'are', 'was', 'were', 'be', 'by', 'from', 'has', 'have',
  'had', 'will', 'can', 'its', 'their', 'about', 'into', 'through', 'after', 'over', 'when'
]);

function extractKeywords(text, n = 8) {
  const freq = {};
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .forEach((w) => {
      if (w.length > 3 && !STOPWORDS.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map((e) => e[0]);
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function buildFallbackFlashcards(topic, keywords) {
  const kws = (keywords && keywords.length > 0) ? keywords : ['trajectory', 'velocity', 'gravity'];
  const labels = { diagrams: 'Educational Diagram', animation: 'Animation Demo', simulation: 'Simulation Lab' };
  const result = {};

  ['diagrams', 'animation', 'simulation'].forEach((type) => {
    result[type] = [0, 1, 2].map((i) => {
      const kw = kws[i % kws.length] || topic;
      return {
        title: `${capitalize(kw)} — ${labels[type]}`,
        description: `Visual educational resource illustrating ${kw} in ${topic}.`,
        query: `${kw} ${topic}`,
      };
    });
  });
  return result;
}

function parseAIResponse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('Unable to parse JSON from AI response: ' + text.slice(0, 150));
  }
}

function sanitizeQuiz(quizArray) {
  if (!Array.isArray(quizArray) || quizArray.length === 0) return [];

  const valid = [];
  for (const q of quizArray) {
    if (!q.question || !Array.isArray(q.options) || q.options.length < 2) continue;

    let ansIdx = typeof q.answerIndex === 'number' ? q.answerIndex : 0;
    if (ansIdx < 0 || ansIdx >= q.options.length) ansIdx = 0;

    while (q.options.length < 4) {
      q.options.push(`Alternative Option ${q.options.length + 1}`);
    }

    valid.push({
      question: String(q.question).trim(),
      options: q.options.slice(0, 4).map(String),
      answerIndex: ansIdx,
    });
  }
  return valid;
}

async function callGroqWithFallback(messages, formatJson = true) {
  const modelQueue = activeWorkingModel
    ? [activeWorkingModel, ...CANDIDATE_MODELS.filter((m) => m !== activeWorkingModel)]
    : CANDIDATE_MODELS;

  let lastErr = null;
  for (const model of modelQueue) {
    try {
      const payload = {
        model,
        messages,
        temperature: 0.1,
      };
      if (formatJson) {
        payload.response_format = { type: 'json_object' };
      }

      const response = await groq.chat.completions.create(payload);
      const content = response.choices[0]?.message?.content;
      if (content) {
        if (!activeWorkingModel) activeWorkingModel = model;
        return { content, modelUsed: model };
      }
    } catch (err) {
      lastErr = err;
      console.warn(`⚠️ Model "${model}" attempt failed (${err.message}). Trying next candidate...`);
      continue;
    }
  }
  throw lastErr || new Error('All candidate models failed.');
}

async function callGroqForChunk(text) {
  const messages = [
    {
      role: 'system',
      content: `You are an expert physics curriculum planner.
Analyze the passage and extract a descriptive topic title, 6 keywords, visual search queries for diagrams, animation, and simulation, and 4 multiple choice questions.

JSON Output Schema:
{
  "topic": "Concise Descriptive Academic Topic Title",
  "keywords": ["term1", "term2", "term3", "term4", "term5", "term6"],
  "flashcards": {
    "diagrams": [{"title": "Title", "description": "Description", "query": "diagram search query"}],
    "animation": [{"title": "Title", "description": "Description", "query": "animation search query"}],
    "simulation": [{"title": "Title", "description": "Description", "query": "simulation search query"}]
  },
  "quiz": [
    {
      "question": "Conceptual multiple-choice question testing the passage mechanics?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0
    }
  ]
}`
    },
    {
      role: 'user',
      content: `Passage Content:\n${text.slice(0, 3500)}`
    }
  ];

  const { content } = await callGroqWithFallback(messages, true);
  return parseAIResponse(content);
}

async function analyzeChunk(text) {
  if (HAS_AI && groq && text && text.trim().length > 20) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const parsed = await callGroqForChunk(text);
        const cleanQuiz = sanitizeQuiz(parsed.quiz);

        if (parsed.topic) {
          return {
            topic: parsed.topic,
            keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0 ? parsed.keywords : extractKeywords(text),
            flashcards: parsed.flashcards || buildFallbackFlashcards(parsed.topic, parsed.keywords),
            quiz: cleanQuiz,
          };
        }
      } catch (e) {
        console.warn(`Chunk analysis attempt ${attempt + 1} error:`, e.message);
        if (e.message && (e.message.includes('429') || e.message.includes('rate'))) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
      }
    }
  }

  const keywords = extractKeywords(text);
  const words = text.replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOPWORDS.has(w.toLowerCase()));
  const topic = words.slice(0, 4).map(capitalize).join(' ') || 'Projectile Motion Fundamentals';

  return {
    topic,
    keywords,
    flashcards: buildFallbackFlashcards(topic, keywords),
    quiz: [],
  };
}

async function generateSummary(rawText, transcript, matchedTopics) {
  if (HAS_AI && groq) {
    try {
      const messages = [
        {
          role: 'system',
          content: `Create a structured classroom summary for students based on the session data.`
        },
        {
          role: 'user',
          content: `PDF Content:\n${(rawText || '').slice(0, 3000)}\n\nTranscript:\n${(transcript || '(No transcript recorded)').slice(0, 3000)}\n\nVisuals Shown:\n${JSON.stringify(matchedTopics || [])}`
        }
      ];
      const { content } = await callGroqWithFallback(messages, false);
      return content;
    } catch (e) {
      console.warn('generateSummary AI error:', e.message);
    }
  }

  const topics = Array.from(new Set((matchedTopics || []).map((t) => t.topic)));
  return (
    '## Class Summary\n\n' +
    '**Topics Covered:**\n' +
    (topics.length ? topics.map((t) => `- ${t}`).join('\n') : '- Projectile Motion Principles')
  );
}

async function answerFromContext(question, chunks, summary) {
  if (HAS_AI && groq) {
    try {
      const context = (chunks || []).map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
      const messages = [
        {
          role: 'system',
          content: `You are a helpful classroom AI tutor. Answer using the provided course context.`
        },
        {
          role: 'user',
          content: `Context:\n${context || 'N/A'}\n\nQuestion: ${question}`
        }
      ];
      const { content } = await callGroqWithFallback(messages, false);
      return content;
    } catch (e) {
      console.warn('answerFromContext AI error:', e.message);
    }
  }
  return 'Based on the lesson context, projectile motion consists of horizontal motion with constant velocity and vertical motion under gravity.';
}

function keywordOverlapScore(text, chunk) {
  const words = new Set((text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/));
  let score = 0;
  (chunk.keywords || []).forEach((k) => {
    if (words.has(k)) score++;
  });
  return score;
}

async function matchTranscriptToChunk(transcriptChunk, material) {
  let best = null;
  let bestScore = -1;
  (material?.chunks || []).forEach((c) => {
    const score = keywordOverlapScore(transcriptChunk, c);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });
  return { chunk: best, score: bestScore, threshold: 1 };
}

async function rankChunksForQuestion(question, material, topN = 4) {
  return (material?.chunks || [])
    .map((c) => ({ ...c, score: keywordOverlapScore(question, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

module.exports = {
  HAS_AI,
  analyzeChunk,
  generateSummary,
  answerFromContext,
  matchTranscriptToChunk,
  rankChunksForQuestion,
};