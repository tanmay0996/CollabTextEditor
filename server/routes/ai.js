// server/routes/ai.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// example: grammar-check
router.post('/grammar-check', auth, async (req, res) => {
  const { text } = req.body;
  // For the assignment: either call Gemini API here OR return a mocked result if key missing.
  if (!process.env.GEMINI_KEY) {
    // Mocked suggestion
    return res.json({ suggestions: [{ index:0, message: 'Try simpler sentences.' }] });
  }
  // TODO: integrate actual Gemini call in services/gemini.js
  res.json({ suggestions: [] });
});

module.exports = router;
