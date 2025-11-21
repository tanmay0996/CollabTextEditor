// server/services/gemini.js
// Default to flash (higher free tier limits) unless user specifies otherwise
const DEFAULT_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').replace(/^models\//, '');
const FALLBACK_MODELS = [
  'gemini-2.5-flash', // Try flash first (higher free tier limits)
  'gemini-2.5-pro',
  'gemini-2.0-flash-exp',
  'gemini-2.0-pro-exp',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
].map((name) => name.replace(/^models\//, ''));
const BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';

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

function resolveApiVersion(modelName) {
  if (process.env.GEMINI_API_VERSION) return process.env.GEMINI_API_VERSION;
  if ((modelName || '').includes('1.5')) return 'v1beta';
  return 'v1';
}

function shouldFallback(err) {
  if (!err) return false;
  if (err.status === 404) return true;
  if (err.code === 'NOT_FOUND') return true;
  if (err.message?.toLowerCase().includes('not found')) return true;
  return false;
}

async function withFallback(generate, options = {}) {
  const tried = new Set();
  const custom = options.model || process.env.GEMINI_MODEL;
  const candidates = custom ? [custom, ...FALLBACK_MODELS] : [DEFAULT_MODEL, ...FALLBACK_MODELS];

  let lastError;
  for (const name of candidates) {
    if (!name || tried.has(name)) continue;
    tried.add(name);
    try {
      const normalized = normalizeModelName(name);
      const apiVersion = resolveApiVersion(normalized);
      console.info(`[Gemini] Attempting model "${normalized}" (apiVersion=${apiVersion})`);
      return await generate({ ...options, model: normalized, apiVersion });
    } catch (err) {
      console.warn(`[Gemini] Model "${name}" failed: ${err?.message}`);
      lastError = err;
      if (!shouldFallback(err)) break;
    }
  }
  console.error('[Gemini] All model attempts failed', { tried: Array.from(tried) });
  throw lastError;
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
    // If parsing fails, try to return a safe fallback object
    console.warn('[Gemini] JSON parse failed, raw response:', cleaned.substring(0, 200));
    return null;
  }
}

function buildGenerationBody(prompt, opts = {}) {
  const generationConfig = {
    temperature: opts.temperature ?? 0.3,
    topP: opts.topP ?? 0.95,
    topK: opts.topK ?? 32,
    maxOutputTokens: opts.maxOutputTokens ?? 512,
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
  if (geminiCallLog.length > 200) geminiCallLog.shift(); // Keep last 200 calls
  
  const recentCalls = geminiCallLog.filter(call => now - call.timestamp < 60000);
  console.log(`[Gemini API] Call to ${modelName} | Total calls in last minute: ${recentCalls.length}`);
}

async function performRequest(modelName, body, apiVersionOverride) {
  ensureApiKey();
  const normalizedName = normalizeModelName(modelName);
  const apiVersion = apiVersionOverride || resolveApiVersion(normalizedName);
  const path = `/${apiVersion}/models/${normalizedName}:generateContent?key=${process.env.GEMINI_KEY}`;
  const url = `${BASE_URL}${path}`;
  
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
  logGeminiCall(normalizedName, true);
  return json;
}

async function generateText(prompt, options = {}) {
  return withFallback(async (opts) => {
    const modelName = normalizeModelName(opts.model || DEFAULT_MODEL);
    const body = buildGenerationBody(prompt, opts);
    const response = await performRequest(modelName, body, opts.apiVersion);
    return extractTextPayload(response);
  }, options);
}

async function generateJson(prompt, options = {}) {
  return withFallback(async (opts) => {
    const modelName = normalizeModelName(opts.model || DEFAULT_MODEL);
    const body = buildGenerationBody(prompt, opts);
    const response = await performRequest(modelName, body, opts.apiVersion);
    const text = extractTextPayload(response);
    return sanitizeJsonResponse(text);
  }, options);
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