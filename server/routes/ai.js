// server/routes/ai.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateJson, getGeminiStats } = require('../services/gemini');

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = Number(process.env.AI_RATE_LIMIT || 10);
const MAX_TEXT_LENGTH = Number(process.env.AI_MAX_TEXT || 8000);

const Typo = require('typo-js');
const dictionary = new Typo('en_US');

const rateBuckets = new Map();
const apiCallLog = [];

function logApiCall(userId, endpoint) {
  const now = Date.now();
  apiCallLog.push({ userId, endpoint, timestamp: now });
  if (apiCallLog.length > 100) apiCallLog.shift();
  
  const recentCalls = apiCallLog.filter(call => now - call.timestamp < 60000);
  console.log(`[API Stats] Total calls in last minute: ${recentCalls.length} | User ${userId} called ${endpoint}`);
}

function isRateLimited(userId) {
  const now = Date.now();
  const bucket = rateBuckets.get(userId) || { count: 0, start: now };
  if (now - bucket.start > RATE_WINDOW_MS) {
    bucket.count = 0;
    bucket.start = now;
  }
  bucket.count += 1;
  rateBuckets.set(userId, bucket);
  return bucket.count > RATE_LIMIT;
}

function pickUserId(user = {}) {
  return user.id || user._id || user.email || user.sub || 'anonymous';
}

function handleGeminiError(err, res) {
  console.error('Gemini error', err);
  if (err?.code === 'GEMINI_KEY_MISSING') {
    return res.status(503).json({ error: 'Gemini API key missing on server' });
  }

  if (err?.status === 429 || err?.message?.includes('overloaded')) {
    return res.status(429).json({ error: 'AI service is busy, please try again in a moment' });
  }

  return res.status(500).json({ error: err?.message || 'Unable to process AI request' });
}

function isTextComplete(text) {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  
  const lastChar = trimmed[trimmed.length - 1];
  const sentenceEnders = ['.', '!', '?', '。', '।'];
  
  // Only block if it ends with punctuation AND looks deliberately finished
  if (sentenceEnders.includes(lastChar)) {
    // Check if there's trailing content that suggests continuation
    const words = trimmed.split(/\s+/);
    const lastWord = words[words.length - 1];
    
    // Allow if the last "sentence" is very short (likely just starting)
    if (lastWord.length <= 3) return false;
    
    return true; // Ends with punctuation, likely complete
  }
  
  return false; // Doesn't end with punctuation, clearly incomplete
}

function isTooShort(text, minLength = 15) {
  return text.trim().length < minLength;
}

async function generateGrammarInsights(text) {
  // First, do a real spell check to find actual errors using typo-js
  const words = text.match(/\b[\w']+\b/g) || [];
  const spellingErrors = [];
  
  words.forEach(word => {
    if (!dictionary.check(word)) {
      const suggestions = dictionary.suggest(word);
      if (suggestions.length > 0) {
        spellingErrors.push({
          word: word,
          suggestions: suggestions.slice(0, 3)
        });
      }
    }
  });

  // Now tell the AI about the spelling errors we found
  const spellingContext = spellingErrors.length > 0 
    ? `\n\nSPELLING ERRORS DETECTED: ${spellingErrors.map(e => `"${e.word}" should be "${e.suggestions[0]}"`).join(', ')}`
    : '';

  const prompt = `You are an expert grammar and spelling checker. Analyze this text for ALL errors.

Text to analyze:
"${text}"
${spellingContext}

Find ALL issues including:
- Spelling mistakes (I've detected some above - YOU MUST include them)
- Grammar errors (subject-verb agreement, tense issues, etc.)
- Punctuation problems (missing commas, incorrect apostrophes, etc.)
- Word choice issues (wrong homophones like "their" vs "there")
- Style improvements (wordiness, passive voice, clarity)

Return JSON with this EXACT structure (NO markdown, NO backticks):
{
  "overallScore": <number 0-100, where 100 is perfect>,
  "readingEase": "<Very Easy|Easy|Moderate|Difficult|Very Difficult>",
  "tone": "<Formal|Professional|Casual|Conversational|Academic|Creative>",
  "correctedText": "<complete text with ALL errors fixed>",
  "corrections": [
    {
      "original": "<exact wrong word/phrase from the text>",
      "corrected": "<exact fixed version>",
      "issue": "<description of what's wrong>",
      "explanation": "<why it matters>",
      "type": "<grammar|spelling|punctuation|style|clarity|word choice>",
      "severity": "<error|warning|info>"
    }
  ]
}

CRITICAL:
- If I detected spelling errors above, you MUST include them in corrections array
- correctedText MUST have ALL errors fixed
- For each error, provide "original" and "corrected" fields
- Be thorough and catch all mistakes`;

  const json = await generateJson(prompt, { 
    temperature: 0.1, 
    maxOutputTokens: 2048,
    model: 'gemini-1.5-flash'
  });
  
  if (!json || typeof json !== 'object') {
    return { 
      overallScore: 0, 
      readingEase: 'unknown', 
      tone: 'unknown', 
      correctedText: text,
      corrections: [] 
    };
  }
  
  if (!Array.isArray(json.corrections)) json.corrections = [];
  
  // If we found spelling errors but AI didn't include them, add them manually
  if (spellingErrors.length > 0) {
    spellingErrors.forEach(error => {
      const alreadyIncluded = json.corrections.some(c => 
        c.original?.toLowerCase() === error.word.toLowerCase()
      );
      
      if (!alreadyIncluded) {
        json.corrections.push({
          original: error.word,
          corrected: error.suggestions[0],
          issue: `Spelling error: "${error.word}" is misspelled`,
          explanation: `The correct spelling is "${error.suggestions[0]}"`,
          type: "spelling",
          severity: "error"
        });
      }
    });
    
    // Also fix the correctedText if AI didn't
    let corrected = json.correctedText || text;
    spellingErrors.forEach(error => {
      const regex = new RegExp(`\\b${error.word}\\b`, 'gi');
      corrected = corrected.replace(regex, error.suggestions[0]);
    });
    json.correctedText = corrected;
  }
  
  // Ensure we have meaningful data
  if (!json.overallScore) json.overallScore = spellingErrors.length > 0 ? 70 : 85;
  if (!json.readingEase) json.readingEase = 'Moderate';
  if (!json.tone) json.tone = 'Conversational';
  if (!json.correctedText) json.correctedText = text;
  
  return json;
}

async function generateEnhancement(text, selectionProvided) {
  const context = selectionProvided 
    ? 'This is a selected portion of text. Improve only this selection.'
    : 'This is the complete document. Improve the overall quality.';

  const prompt = `You are a professional editor. Rewrite this text to make it better while keeping the same meaning.

Original text:
"${text}"

Context: ${context}

Improvements to make:
- Fix any grammar or spelling errors
- Improve clarity and flow
- Make it more engaging and professional
- Enhance word choice
- Keep the same tone and meaning

Return JSON with this EXACT structure:
{
  "improved": "<the complete rewritten text>",
  "tone": "<description of tone used>",
  "rationale": "<brief explanation of main improvements>"
}

IMPORTANT: The "improved" field must contain the COMPLETE rewritten text, not just changes.`;

  const json = await generateJson(prompt, { 
    temperature: 0.4, 
    maxOutputTokens: 2048,
    model: 'gemini-1.5-flash'
  });
  
  if (!json || typeof json !== 'object') {
    return { improved: text, tone: 'unknown', rationale: 'Could not generate enhancement' };
  }
  
  if (!json.improved || json.improved.trim().length === 0) {
    json.improved = text;
    json.rationale = 'No improvements needed - text is already well-written.';
  }
  
  return json;
}

async function generateSummary(text) {
  const prompt = `Summarize this document concisely for someone who hasn't read it.

Document:
"${text}"

Return JSON with this EXACT structure:
{
  "summary": "<2-3 clear sentences capturing the main points>",
  "bullets": [
    "<key point 1>",
    "<key point 2>",
    "<key point 3>",
    "<key point 4>"
  ]
}

Make the summary informative and the bullet points specific.`;

  const json = await generateJson(prompt, { 
    temperature: 0.2, 
    maxOutputTokens: 1024,
    model: 'gemini-1.5-flash'
  });
  
  if (!json || typeof json !== 'object') {
    return { summary: '', bullets: [] };
  }
  if (!Array.isArray(json.bullets)) json.bullets = [];
  return json;
}

async function generateIdeas(text) {
  const prompt = `Provide 4-5 specific, actionable writing suggestions to improve this text.

Text:
"${text}"

Return JSON with this EXACT structure:
{
  "ideas": [
    {
      "title": "<short suggestion title, max 8 words>",
      "detail": "<specific actionable recommendation>"
    }
  ]
}

Focus on: structure, content depth, style improvements, engagement, and clarity.`;

  const json = await generateJson(prompt, { 
    temperature: 0.35, 
    maxOutputTokens: 1024,
    model: 'gemini-1.5-flash'
  });
  
  if (!json || typeof json !== 'object') {
    return { ideas: [] };
  }
  if (!Array.isArray(json.ideas)) json.ideas = [];
  return json;
}

async function generateCompletion(context) {
  const prompt = `Continue this writing naturally. Write 1-2 sentences that flow smoothly from the existing text.

Existing text:
"${context}"

Return JSON with this EXACT structure:
{
  "completion": "<1-2 sentences that continue the text naturally>",
  "confidence": <number between 0.0 and 1.0>
}

IMPORTANT: 
- Only write NEW text that continues the thought
- Do NOT repeat or rephrase existing content
- Make it flow naturally from the last sentence
- Match the writing style and tone`;

  const json = await generateJson(prompt, { 
    temperature: 0.7, 
    maxOutputTokens: 512,
    model: 'gemini-1.5-flash'
  });
  
  if (!json || typeof json !== 'object') {
    return { completion: '', confidence: 0 };
  }
  
  if (json.completion) {
    json.completion = json.completion.trim();
  }
  
  return json;
}

// Grammar check endpoint
router.post('/grammar-check', auth, async (req, res) => {
  const { text = '' } = req.body || {};
  
  if (!text.trim()) {
    return res.status(400).json({ error: 'Text is required', userMessage: 'Please add some text to check grammar.' });
  }

  if (isTooShort(text, 10)) {
    return res.status(400).json({ 
      error: 'Text too short', 
      userMessage: 'Please write at least 10 characters for grammar checking.' 
    });
  }

  const userId = pickUserId(req.user);
  logApiCall(userId, '/grammar-check');
  
  if (isRateLimited(userId)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  try {
    const trimmed = text.slice(-MAX_TEXT_LENGTH);
    const payload = await generateGrammarInsights(trimmed);
    console.log('[Grammar] Found corrections:', payload.corrections?.length || 0);
    return res.json(payload);
  } catch (err) {
    return handleGeminiError(err, res);
  }
});

// Text enhancement endpoint
router.post('/enhance-text', auth, async (req, res) => {
  const { text = '', selection = '' } = req.body || {};
  const target = selection?.trim() || text?.trim();
  
  if (!target) {
    return res.status(400).json({ 
      error: 'Text required', 
      userMessage: 'Please write some text or select text to enhance.' 
    });
  }

  if (isTooShort(target, 15)) {
    return res.status(400).json({ 
      error: 'Text too short', 
      userMessage: 'Please provide at least 15 characters to enhance.' 
    });
  }

  const userId = pickUserId(req.user);
  logApiCall(userId, '/enhance-text');
  
  if (isRateLimited(userId)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  try {
    const trimmed = target.slice(-MAX_TEXT_LENGTH);
    const payload = await generateEnhancement(trimmed, Boolean(selection?.trim()));
    console.log('[Enhancement] Generated:', payload.improved?.length || 0, 'chars');
    return res.json(payload);
  } catch (err) {
    return handleGeminiError(err, res);
  }
});

// Summarize endpoint
router.post('/summarize', auth, async (req, res) => {
  const { text = '' } = req.body || {};
  
  if (!text.trim()) {
    return res.status(400).json({ 
      error: 'Text required', 
      userMessage: 'Please add some content to summarize.' 
    });
  }

  if (isTooShort(text, 50)) {
    return res.status(400).json({ 
      error: 'Text too short', 
      userMessage: 'Please write more content (at least 50 characters) for a meaningful summary.' 
    });
  }

  const userId = pickUserId(req.user);
  logApiCall(userId, '/summarize');
  
  if (isRateLimited(userId)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  try {
    const trimmed = text.slice(-MAX_TEXT_LENGTH);
    const payload = await generateSummary(trimmed);
    return res.json(payload);
  } catch (err) {
    return handleGeminiError(err, res);
  }
});

// Suggestions endpoint
router.post('/get-suggestions', auth, async (req, res) => {
  const { text = '' } = req.body || {};
  
  if (!text.trim()) {
    return res.status(400).json({ 
      error: 'Text required', 
      userMessage: 'Please write some content to get suggestions.' 
    });
  }

  if (isTooShort(text, 30)) {
    return res.status(400).json({ 
      error: 'Text too short', 
      userMessage: 'Please write more content (at least 30 characters) to get meaningful suggestions.' 
    });
  }

  const userId = pickUserId(req.user);
  logApiCall(userId, '/get-suggestions');
  
  if (isRateLimited(userId)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  try {
    const trimmed = text.slice(-MAX_TEXT_LENGTH);
    const payload = await generateIdeas(trimmed);
    return res.json(payload);
  } catch (err) {
    return handleGeminiError(err, res);
  }
});

// Auto-complete endpoint
router.post('/auto-complete', auth, async (req, res) => {
  const { text = '', cursor } = req.body || {};
  
  if (!text.trim()) {
    return res.status(400).json({ 
      error: 'Text required', 
      userMessage: 'Start typing to get auto-completion suggestions.' 
    });
  }

  if (isTooShort(text, 10)) {
    return res.status(400).json({ 
      error: 'Text too short', 
      userMessage: 'Write at least a few words before using auto-complete.' 
    });
  }

  if (isTextComplete(text)) {
    return res.status(400).json({ 
      error: 'Text already complete', 
      userMessage: 'Your text appears to be complete. Try writing an incomplete sentence for auto-completion.' 
    });
  }

  const userId = pickUserId(req.user);
  logApiCall(userId, '/auto-complete');
  
  if (isRateLimited(userId)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  try {
    const trimmed = text.slice(-MAX_TEXT_LENGTH);
    const cursorPos = (cursor !== undefined && cursor !== null && Number.isFinite(cursor)) 
      ? Math.min(Math.max(cursor, 0), trimmed.length) 
      : trimmed.length;
    
    const contextBeforeCursor = trimmed.slice(0, cursorPos);
    const context = contextBeforeCursor.slice(-1000);
    
    console.log(`[Auto-complete] Context length: ${context.length}, Cursor: ${cursorPos}`);
    
    const payload = await generateCompletion(context);
    console.log('[Auto-complete] Generated:', payload.completion?.length || 0, 'chars');
    return res.json(payload);
  } catch (err) {
    return handleGeminiError(err, res);
  }
});

// Stats endpoint
router.get('/stats', auth, (req, res) => {
  const now = Date.now();
  const lastMinute = apiCallLog.filter(call => now - call.timestamp < 60000);
  const last5Minutes = apiCallLog.filter(call => now - call.timestamp < 300000);
  
  const userId = pickUserId(req.user);
  const userCallsLastMin = lastMinute.filter(call => call.userId === userId).length;
  const userCallsLast5Min = last5Minutes.filter(call => call.userId === userId).length;
  
  const geminiStats = getGeminiStats();
  
  res.json({
    global: {
      apiCallsLastMinute: lastMinute.length,
      apiCallsLast5Minutes: last5Minutes.length,
    },
    gemini: {
      apiCallsLastMinute: geminiStats.callsLastMinute,
      apiCallsLast5Minutes: geminiStats.callsLast5Minutes,
      successLastMinute: geminiStats.successLastMinute,
      failedLastMinute: geminiStats.failedLastMinute,
    },
    user: {
      apiCallsLastMinute: userCallsLastMin,
      apiCallsLast5Minutes: userCallsLast5Min,
      rateLimit: RATE_LIMIT,
      rateLimitWindow: '1 minute',
    },
  });
});

module.exports = router;