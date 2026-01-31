// server/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.cookies ? req.cookies.sid : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email } as we set earlier
    next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' });
  }
};
