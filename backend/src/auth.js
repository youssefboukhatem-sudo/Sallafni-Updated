const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');
const db = require('./db');

const sign = (user) => jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });

/** Requires a valid Bearer token; sets req.user (DB row). */
function requireAuth(req, res, next) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const { sub } = jwt.verify(m[1], JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sub);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

/** Like requireAuth but anonymous requests are allowed (req.user = null). */
function optionalAuth(req, _res, next) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  req.user = null;
  if (m) {
    try {
      const { sub } = jwt.verify(m[1], JWT_SECRET);
      req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(sub) || null;
    } catch { /* treat as anonymous */ }
  }
  next();
}

module.exports = { sign, requireAuth, optionalAuth };
