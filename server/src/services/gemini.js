// server/services/gemini.js
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';

// REMOVED: Aggressive fallback array - we trust the env var

function ensureApiKey() {
  if (!process.env.GEMINI_KEY) {
    const err = new Error('Gemini API key is not configured');
    err.code = 'GEMINI_KEY_MISSING';
    throw err;
  }
}

function normalizeModelName(name) {
  if (!name) return DEFAULT_MODEL;
  return name.replace(/^models\//, '');
}

// Fixed: Proper API version resolution for all models
function resolveApiVersion(modelName) {
  if (process.env.GEMINI_API_VERSION) return process.env.GEMINI_API_VERSION;
  
  const normalized = (modelName || '').toLowerCase();
  
  // Models that ONLY work with v1
  if (normalized.includes('2.5') || normalized.includes('2.0')) {
    return 'v1';
  }
  
  // Models that work with v1beta (1.5 series)
  if (normalized.includes('1.5')) {
    return 'v1beta';
  }
  
  // Default to v1 for unknown models
  return 'v1';
}

function sanitizeJsonResponse(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  let cleaned = raw.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  }
  
  // Try to extract JSON from text if it's wrapped
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  try {
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    console.warn('[Gemini] JSON parse failed, raw response:', cleaned.substring(0, 200));
    return null;
  }
}

function buildGenerationBody(prompt, opts = {}) {
  const generationConfig = {
    temperature: opts.temperature ?? 0.3,
    topP: opts.topP ?? 0.95,
    topK: opts.topK ?? 32,
    maxOutputTokens: opts.maxOutputTokens ?? 8192, // Increased from 512
  };

  return {
    contents: [{ role: 'user', parts: [{ text: prompt }]}],
    generationConfig,
  };
}

function extractTextPayload(response) {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  const textPart = parts.find((part) => typeof part?.text === 'string');
  return textPart?.text?.trim() || '';
}

// Track Gemini API calls
const geminiCallLog = [];
function logGeminiCall(modelName, success) {
  const now = Date.now();
  geminiCallLog.push({ modelName, success, timestamp: now });
  if (geminiCallLog.length > 200) geminiCallLog.shift();
  
  const recentCalls = geminiCallLog.filter(call => now - call.timestamp < 60000);
  console.log(`[Gemini API] Call to ${modelName} | Total calls in last minute: ${recentCalls.length}`);
}

async function performRequest(modelName, body, apiVersionOverride) {
  ensureApiKey();
  const normalizedName = normalizeModelName(modelName);
  const apiVersion = apiVersionOverride || resolveApiVersion(normalizedName);
  const path = `/${apiVersion}/models/${normalizedName}:generateContent?key=${process.env.GEMINI_KEY}`;
  const url = `${BASE_URL}${path}`;
  
  console.log(`[Gemini] Calling ${normalizedName} via ${apiVersion}`);
  
  const startTime = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let json;
  try {
    json = await res.json();
  } catch (err) {
    const error = new Error(`Gemini response parse failed (${res.status})`);
    error.status = res.status;
    logGeminiCall(normalizedName, false);
    throw error;
  }

  if (!res.ok) {
    const message = json?.error?.message || `Gemini request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    error.code = json?.error?.status || res.statusText;
    logGeminiCall(normalizedName, false);
    throw error;
  }

  const duration = Date.now() - startTime;
  console.log(`[Gemini] Success in ${duration}ms`);
  logGeminiCall(normalizedName, true);
  return json;
}

// SIMPLIFIED: No fallback unless explicitly needed
async function generateText(prompt, options = {}) {
  const modelName = normalizeModelName(options.model || DEFAULT_MODEL);
  const body = buildGenerationBody(prompt, options);
  const response = await performRequest(modelName, body, options.apiVersion);
  return extractTextPayload(response);
}

async function generateJson(prompt, options = {}) {
  const modelName = normalizeModelName(options.model || DEFAULT_MODEL);
  const body = buildGenerationBody(prompt, options);
  const response = await performRequest(modelName, body, options.apiVersion);
  const text = extractTextPayload(response);
  return sanitizeJsonResponse(text);
}

function getGeminiStats() {
  const now = Date.now();
  const lastMinute = geminiCallLog.filter(call => now - call.timestamp < 60000);
  const last5Minutes = geminiCallLog.filter(call => now - call.timestamp < 300000);
  
  return {
    callsLastMinute: lastMinute.length,
    callsLast5Minutes: last5Minutes.length,
    successLastMinute: lastMinute.filter(c => c.success).length,
    failedLastMinute: lastMinute.filter(c => !c.success).length,
  };
}

module.exports = {
  generateText,
  generateJson,
  getGeminiStats,
};