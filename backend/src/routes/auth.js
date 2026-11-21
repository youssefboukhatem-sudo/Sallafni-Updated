const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, requireAuth } = require('../auth');
const { imageUpload, removeUpload } = require('../upload');
const S = require('../serialize');

const uploadAvatar = imageUpload(2);

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// POST /api/auth/register  { email, password }
router.post('/register', (req, res) => {
  const email = String(req.body.email ?? '').trim();
  const password = String(req.body.password ?? '');
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  const info = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email, bcrypt.hashSync(password, 10));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: sign(user), user: S.me(user) });
});

// POST /api/auth/login  { email, password }
router.post('/login', (req, res) => {
  const email = String(req.body.email ?? '').trim();
  const password = String(req.body.password ?? '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  res.json({ token: sign(user), user: S.me(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json(S.me(req.user)));

// PUT /api/auth/me  (profile)
router.put('/me', requireAuth, (req, res) => {
  const b = req.body ?? {};
  const str = (v, max = 120) => String(v ?? '').trim().slice(0, max);
  const next = {
    first_name: str(b.fn), last_name: str(b.ln), country: str(b.country) || 'Tunisia',
    phone: str(b.phone, 30), street: str(b.street, 200), line2: str(b.line2, 200),
    city: str(b.city), area: str(b.area), state: str(b.state), zip: str(b.zip, 20),
  };
  for (const [k, label] of [['first_name', 'First name'], ['last_name', 'Last name'], ['phone', 'Phone'], ['street', 'Street address'], ['city', 'City']]) {
    if (!next[k]) return res.status(400).json({ error: `${label} is required.` });
  }
  const lat = b.lat == null ? null : Number(b.lat);
  const lng = b.lng == null ? null : Number(b.lng);
  const validGeo = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  db.prepare(`UPDATE users SET first_name=@first_name, last_name=@last_name, country=@country, phone=@phone,
      street=@street, line2=@line2, city=@city, area=@area, state=@state, zip=@zip, lat=@lat, lng=@lng WHERE id=@id`)
    .run({ ...next, lat: validGeo ? lat : null, lng: validGeo ? lng : null, id: req.user.id });

  res.json(S.me(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
});

// PATCH /api/auth/me/profile  { fn, ln, bio }   (social profile: name + short description)
router.patch('/me/profile', requireAuth, (req, res) => {
  const b = req.body ?? {};
  const fn = String(b.fn ?? '').trim();
  const ln = String(b.ln ?? '').trim();
  const bio = String(b.bio ?? '').trim();
  if (!fn) return res.status(400).json({ error: 'First name is required.' });
  if (!ln) return res.status(400).json({ error: 'Last name is required.' });
  if (fn.length > 50 || ln.length > 50) return res.status(400).json({ error: 'Names must be 50 characters or fewer.' });
  if (bio.length > 200) return res.status(400).json({ error: 'Description must be 200 characters or fewer.' });
  db.prepare('UPDATE users SET first_name = ?, last_name = ?, bio = ? WHERE id = ?').run(fn, ln, bio, req.user.id);
  res.json(S.me(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
});

// PUT /api/auth/me/avatar  (multipart field "avatar": JPG/PNG/WebP/GIF, max 2 MB)
router.put('/me/avatar', requireAuth, (req, res) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller.' : err.message });
    if (!req.file) return res.status(400).json({ error: 'Choose an image.' });
    removeUpload(req.user.avatar);
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(`/uploads/${req.file.filename}`, req.user.id);
    res.json(S.me(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
  });
});

// DELETE /api/auth/me/avatar
router.delete('/me/avatar', requireAuth, (req, res) => {
  removeUpload(req.user.avatar);
  db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(req.user.id);
  res.json(S.me(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
});

// DELETE /api/auth/me  { password }   permanently deletes the account and everything it owns
router.delete('/me', requireAuth, (req, res) => {
  const password = String(req.body?.password ?? '');
  if (!bcrypt.compareSync(password, req.user.password_hash)) {
    return res.status(403).json({ error: 'Incorrect password.' });
  }
  const id = req.user.id;

  // Same spirit as "can't delete an item that is on loan": finish active loans first.
  const active = db.prepare(`SELECT 1 FROM requests r JOIN items i ON i.id = r.item_id
                             WHERE r.status = 'accepted' AND (r.borrower_id = ? OR i.owner_id = ?)`).get(id, id);
  if (active) {
    return res.status(409).json({ error: 'You have an active loan. Mark it as returned before deleting your account.' });
  }

  const files = [req.user.avatar, ...db.prepare('SELECT image FROM items WHERE owner_id = ?').all(id).map((r) => r.image)];
  db.transaction(() => {
    // Reviews this user wrote disappear with the account (ON DELETE CASCADE), so take their scores
    // back out of the other people's rating totals to keep score and review list consistent.
    for (const r of db.prepare('SELECT ratee_id, score FROM ratings WHERE rater_id = ?').all(id)) {
      db.prepare('UPDATE users SET rating_sum = rating_sum - ?, rating_count = rating_count - 1 WHERE id = ?').run(r.score, r.ratee_id);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id); // cascades: items, requests, ratings
  })();
  files.forEach(removeUpload);
  res.status(204).end();
});

module.exports = router;
