// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const authMiddleware = require('../middleware/auth'); // expects req.header('Authorization') -> "Bearer <token>"

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').isLength({ min: 2 }).withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;
    try {
      let user = await User.findOne({ email });
      if (user) return res.status(400).json({ error: 'User already exists' });

      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);

      user = new User({ name: name.trim(), email: email.toLowerCase().trim(), password: hashed });
      await user.save();

      const payload = { id: user._id, name: user.name, email: user.email };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

      return res.status(201).json({ token, user: payload });
    } catch (err) {
      console.error('Register error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').exists().withMessage('Password required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

      const payload = { id: user._id, name: user.name, email: user.email };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

      return res.json({ token, user: payload });
    } catch (err) {
      console.error('Login error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/auth/me  (protected)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // auth middleware sets req.user = decoded token payload { id, name, email }
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    console.error('Me error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout  (stateless - client should drop token)
router.post('/logout', authMiddleware, async (req, res) => {
  // Optionally implement server-side blacklist here.
  return res.json({ ok: true, msg: 'Logout success (client should delete token)' });
});

// GET /api/auth/first-time  -> returns whether there are zero users (first-time setup)
router.get('/first-time', async (req, res) => {
  try {
    const count = await User.countDocuments();
    return res.json({ firstTime: count === 0 });
  } catch (err) {
    console.error('first-time check error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
