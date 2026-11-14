const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, requireAuth } = require('../auth');
const S = require('../serialize');

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

module.exports = router;
