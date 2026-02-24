// server/src/routes/voice.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateText } = require('../services/gemini');
const { voiceLogger } = require('../utils/voiceLogger');

const CLEAN_PROMPT = (raw) =>
    `Clean up this voice dictation. Remove filler words (um, uh, like, you know), fix punctuation, capitalize properly, and make it read naturally. Return only the cleaned text, nothing else.\n\nRaw input: ${raw}`;

// Per-user rate limit: max 3 concurrent cleans
const MAX_CONCURRENT = 3;
const inFlight = new Map();

function pickUserId(user = {}) {
    return user.id || user._id || user.email || 'anonymous';
}

function acquireSlot(userId) {
    const current = inFlight.get(userId) || 0;
    if (current >= MAX_CONCURRENT) return false;
    inFlight.set(userId, current + 1);
    return true;
}

function releaseSlot(userId) {
    const current = inFlight.get(userId) || 1;
    if (current <= 1) inFlight.delete(userId);
    else inFlight.set(userId, current - 1);
}

// POST /api/voice/clean
router.post('/clean', auth, async (req, res) => {
    const userId = pickUserId(req.user);
    const { text } = req.body;

    voiceLogger.info('clean:received', { userId, textLen: text?.length });

    if (!text?.trim()) {
        voiceLogger.warn('clean:rejected', { reason: 'empty text' });
        return res.status(400).json({ error: 'No text to clean' });
    }

    if (text.length > 10000) {
        voiceLogger.warn('clean:rejected', { reason: 'too long', len: text.length });
        return res.status(400).json({ error: 'Text too long (max 10,000 chars)' });
    }

    if (!acquireSlot(userId)) {
        voiceLogger.warn('rateLimit:hit', { userId });
        res.set('Retry-After', '2');
        return res.status(429).json({ error: 'Too many requests. Wait a moment.' });
    }

    const t0 = Date.now();
    try {
        const prompt = CLEAN_PROMPT(text);
        voiceLogger.debug('clean:start', { rawLen: text.length });

        const cleaned = await generateText(prompt, { temperature: 0.1, maxOutputTokens: 4096 });
        const latency = Date.now() - t0;

        voiceLogger.info('clean:success', { latencyMs: latency, rawLen: text.length, cleanLen: cleaned?.length });

        return res.json({ cleaned: cleaned || text });
    } catch (err) {
        const latency = Date.now() - t0;
        voiceLogger.error('clean:error', { latencyMs: latency, message: err.message });
        // Return original text as fallback so the client still has something
        return res.status(500).json({ error: err.message, cleaned: text });
    } finally {
        releaseSlot(userId);
    }
});

module.exports = router;
