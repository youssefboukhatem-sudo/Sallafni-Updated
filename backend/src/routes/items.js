const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../auth');
const { UPLOAD_DIR } = require('../config');
const S = require('../serialize');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(EXT[file.mimetype] ? null : new Error('Please choose a JPG, PNG, WebP or GIF image.'), Boolean(EXT[file.mimetype])),
});

const SELECT = `
  SELECT i.*, u.email o_email, u.first_name o_first_name, u.city o_city, u.area o_area,
         u.lat o_lat, u.lng o_lng, u.rating_sum o_sum, u.rating_count o_count
  FROM items i JOIN users u ON u.id = i.owner_id`;

const CATEGORIES = ['Tools', 'Outdoor', 'Bikes', 'Electronics', 'Party gear'];

// GET /api/items?category=Tools&free=1&q=drill   (public)
router.get('/', (req, res) => {
  const where = [];
  const params = {};
  if (req.query.category) { where.push('i.category = @category'); params.category = String(req.query.category); }
  if (req.query.free === '1' || req.query.free === 'true') where.push('i.price = 0');
  if (req.query.q) { where.push('(i.name LIKE @q OR i.description LIKE @q OR i.category LIKE @q)'); params.q = `%${String(req.query.q).trim()}%`; }
  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.id`;
  res.json(db.prepare(sql).all(params).map(S.item));
});

// GET /api/items/mine
router.get('/mine', requireAuth, (req, res) => {
  res.json(db.prepare(`${SELECT} WHERE i.owner_id = ? ORDER BY i.id`).all(req.user.id).map(S.item));
});

// GET /api/items/:id (public)
router.get('/:id(\\d+)', (req, res) => {
  const row = db.prepare(`${SELECT} WHERE i.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Item not found.' });
  res.json(S.item(row));
});

// POST /api/items  (multipart: name, category, condition, price, description?, photo?)
router.post('/', requireAuth, (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const fail = (status, msg) => {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(status).json({ error: msg });
    };
    const name = String(req.body.name ?? '').trim().slice(0, 80);
    const category = String(req.body.category ?? '');
    const condition = String(req.body.condition ?? 'Good').slice(0, 30);
    const price = Number(req.body.price ?? 0) || 0;
    const description = String(req.body.description ?? '').trim().slice(0, 300);
    if (!name) return fail(400, 'Item name is required.');
    if (!CATEGORIES.includes(category)) return fail(400, 'Choose a valid category.');
    if (price < 0 || price > 10000) return fail(400, 'Price must be between 0 and 10000.');

    const info = db
      .prepare('INSERT INTO items (owner_id, name, description, category, price, condition, image) VALUES (?,?,?,?,?,?,?)')
      .run(req.user.id, name, description || category, category, price, condition, req.file ? `/uploads/${req.file.filename}` : null);
    res.status(201).json(S.item(db.prepare(`${SELECT} WHERE i.id = ?`).get(info.lastInsertRowid)));
  });
});

// DELETE /api/items/:id  (owner only)
router.delete('/:id(\\d+)', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Item not found.' });
  if (row.owner_id !== req.user.id) return res.status(403).json({ error: 'This is not your item.' });
  if (db.prepare("SELECT 1 FROM requests WHERE item_id = ? AND status = 'accepted'").get(row.id)) {
    return res.status(409).json({ error: 'This item is currently on loan.' });
  }
  db.prepare('DELETE FROM items WHERE id = ?').run(row.id);
  if (row.image) fs.unlink(path.join(UPLOAD_DIR, path.basename(row.image)), () => {});
  res.status(204).end();
});

module.exports = router;
