// server/src/services/transcribe.js
const { voiceLogger } = require('../utils/voiceLogger');

const BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
const TRANSCRIBE_MODEL = 'gemini-2.5-flash';
const TRANSCRIBE_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

// The instruction sent to Gemini — also used to detect prompt echo in response
const TRANSCRIPTION_PROMPT = 'You are a speech-to-text transcriber. Output ONLY the spoken words. No instructions, no explanations, no extra text. If the audio is silence, output exactly: <EMPTY>';

function ensureApiKey() {
    if (!process.env.GEMINI_KEY) {
        const err = new Error('Gemini API key is not configured');
        err.code = 'GEMINI_KEY_MISSING';
        throw err;
    }
}

// Strip prompt echo, sentinel tokens, and Gemini preamble from transcript
function sanitizeTranscript(text) {
    if (!text) return '';

    let cleaned = text;

    // Remove the exact instruction prompt if Gemini echoed it
    // Use fragments so partial echoes are also caught
    const echoFragments = [
        'Transcribe this audio exactly as spoken',
        'Return only the transcribed text',
        'nothing else',
        'If the audio is silent or unintelligible',
        'return an empty string',
        'You are a speech-to-text transcriber',
        'Output ONLY the spoken words',
        'No instructions, no explanations, no extra text',
        'If the audio is silence, output exactly',
    ];

    for (const frag of echoFragments) {
        // Case-insensitive removal, including trailing punctuation
        const re = new RegExp(frag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[.,:;!]?\\s*', 'gi');
        cleaned = cleaned.replace(re, '');
    }

    // Remove <EMPTY> sentinel
    cleaned = cleaned.replace(/<EMPTY>/gi, '');

    // Trim leftover whitespace
    cleaned = cleaned.trim();

    if (cleaned !== text) {
        voiceLogger.warn('sanitize:stripped', { originalLen: text.length, cleanLen: cleaned.length });
    }

    return cleaned;
}

async function callGeminiAudio(audioBuffer, mimeType) {
    ensureApiKey();

    const base64Audio = audioBuffer.toString('base64');
    const url = `${BASE_URL}/v1/models/${TRANSCRIBE_MODEL}:generateContent?key=${process.env.GEMINI_KEY}`;

    const body = {
        contents: [{
            role: 'user',
            parts: [
                {
                    inlineData: {
                        mimeType,
                        data: base64Audio,
                    },
                },
                {
                    text: TRANSCRIPTION_PROMPT,
                },
            ],
        }],
        generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 4096,
        },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => {
        voiceLogger.warn('gemini:timeout', { timeoutMs: TRANSCRIBE_TIMEOUT_MS });
        controller.abort();
    }, TRANSCRIBE_TIMEOUT_MS);

    voiceLogger.debug('gemini:request', { model: TRANSCRIBE_MODEL, audioSizeBytes: audioBuffer.length, mimeType });
    const t0 = Date.now();

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        const json = await res.json();
        const latency = Date.now() - t0;

        if (!res.ok) {
            const message = json?.error?.message || `Gemini transcription failed (${res.status})`;
            voiceLogger.error('gemini:error', { status: res.status, latencyMs: latency, message });
            const error = new Error(message);
            error.status = res.status;
            throw error;
        }

        const parts = json?.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) {
            voiceLogger.debug('gemini:response', { latencyMs: latency, textLen: 0, note: 'no parts' });
            return '';
        }
        const textPart = parts.find((p) => typeof p?.text === 'string');
        const raw = textPart?.text?.trim() || '';
        const result = sanitizeTranscript(raw);
        voiceLogger.debug('gemini:response', { latencyMs: latency, rawLen: raw.length, cleanLen: result.length });
        return result;
    } finally {
        clearTimeout(timer);
    }
}

async function transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const text = await callGeminiAudio(audioBuffer, mimeType);
            voiceLogger.info('transcribe:done', { attempt: attempt + 1, textLen: text.length });
            return text;
        } catch (err) {
            lastError = err;
            voiceLogger.warn('transcribe:retry', { attempt: attempt + 1, message: err.message });
            if (attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, 500));
            }
        }
    }

    throw lastError;
}

module.exports = { transcribeAudio };
