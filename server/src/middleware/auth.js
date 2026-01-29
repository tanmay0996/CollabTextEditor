// server/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const header = req.header('Authorization');
  const token = header ? header.split(' ')[1] : null;
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email } as we set earlier
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid' });
  }
};
