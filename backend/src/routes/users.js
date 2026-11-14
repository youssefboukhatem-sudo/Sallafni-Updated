const router = require('express').Router();
const db = require('../db');
const S = require('../serialize');

// GET /api/users/:id  public profile + reviews (no private data)
router.get('/:id(\\d+)', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const reviews = db.prepare(`SELECT r.score, r.comment, r.created_at createdAt, a.first_name reviewer
                              FROM ratings r JOIN users a ON a.id = r.rater_id
                              WHERE r.ratee_id = ? ORDER BY r.id DESC LIMIT 20`).all(u.id);
  res.json({ ...S.publicUser(u), reviews });
});

module.exports = router;
