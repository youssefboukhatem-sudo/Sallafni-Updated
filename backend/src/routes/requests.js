const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const S = require('../serialize');

router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s) => DATE_RE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5) + 1;

const overlapsAccepted = (itemId, from, to, ignoreId = 0) =>
  db.prepare(`SELECT 1 FROM requests WHERE item_id = ? AND status = 'accepted' AND id != ?
              AND date_from <= ? AND date_to >= ?`).get(itemId, ignoreId, to, from);

const myRating = db.prepare('SELECT score FROM ratings WHERE request_id = ? AND rater_id = ?');

/* ---- outgoing: requests I made as a borrower ---- */
const OUT_SQL = `
  SELECT r.*, i.name item_name, i.owner_id, u.first_name l_first, u.email l_email, u.city l_city, u.area l_area,
         u.street l_street, u.rating_sum l_sum, u.rating_count l_count
  FROM requests r JOIN items i ON i.id = r.item_id JOIN users u ON u.id = i.owner_id`;

const outgoing = (r, viewerId) => {
  const shared = r.status === 'accepted' || r.status === 'returned';
  return {
    id: r.id, status: r.status, from: r.date_from, to: r.date_to, note: r.note, total: r.total_price,
    returnedAt: r.returned_at, createdAt: r.created_at,
    item: { id: r.item_id, name: r.item_name },
    lender: S.publicUser({ id: r.owner_id, email: r.l_email, first_name: r.l_first, city: r.l_city, area: r.l_area, rating_sum: r.l_sum, rating_count: r.l_count }),
    // The exact street is only revealed once the lender has accepted.
    address: shared ? { street: r.l_street, area: r.l_area, city: r.l_city } : null,
    rated: myRating.get(r.id, viewerId)?.score ?? null,
  };
};

// POST /api/requests  { itemId, from, to, note? }
router.post('/', (req, res) => {
  const itemId = Number(req.body.itemId);
  const from = String(req.body.from ?? '');
  const to = String(req.body.to ?? '');
  const note = String(req.body.note ?? '').trim().slice(0, 200);

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.owner_id === req.user.id) return res.status(400).json({ error: 'You cannot borrow your own item.' });
  if (!isRealDate(from) || !isRealDate(to)) return res.status(400).json({ error: 'Choose valid pick-up and return dates.' });
  if (from < todayStr() || to < from) return res.status(400).json({ error: 'Choose a pick-up date from today, and a return date on or after it.' });
  if (!req.user.first_name || !req.user.city) return res.status(400).json({ error: 'Complete your profile before sending a request.' });
  if (db.prepare("SELECT 1 FROM requests WHERE item_id = ? AND borrower_id = ? AND status IN ('pending','accepted')").get(itemId, req.user.id)) {
    return res.status(409).json({ error: 'You already have an open request for this item.' });
  }
  if (overlapsAccepted(itemId, from, to)) return res.status(409).json({ error: 'This item is already booked for those dates.' });

  const total = daysBetween(from, to) * item.price;
  const info = db.prepare('INSERT INTO requests (item_id, borrower_id, date_from, date_to, note, total_price) VALUES (?,?,?,?,?,?)')
    .run(itemId, req.user.id, from, to, note, total);
  res.status(201).json(outgoing(db.prepare(`${OUT_SQL} WHERE r.id = ?`).get(info.lastInsertRowid), req.user.id));
});

// GET /api/requests/outgoing
router.get('/outgoing', (req, res) => {
  const rows = db.prepare(`${OUT_SQL} WHERE r.borrower_id = ? ORDER BY r.id DESC`).all(req.user.id);
  res.json(rows.map((r) => outgoing(r, req.user.id)));
});

/* ---- incoming: requests for my items (I am the lender) ---- */
const IN_SQL = `
  SELECT r.*, i.name item_name, i.owner_id, b.first_name b_first, b.email b_email, b.city b_city, b.area b_area,
         b.rating_sum b_sum, b.rating_count b_count
  FROM requests r JOIN items i ON i.id = r.item_id JOIN users b ON b.id = r.borrower_id`;

const incoming = (r, viewerId) => ({
  id: r.id, status: r.status, from: r.date_from, to: r.date_to, note: r.note, total: r.total_price,
  returnedAt: r.returned_at, createdAt: r.created_at,
  item: { id: r.item_id, name: r.item_name },
  borrower: S.publicUser({ id: r.borrower_id, email: r.b_email, first_name: r.b_first, city: r.b_city, area: r.b_area, rating_sum: r.b_sum, rating_count: r.b_count }),
  rated: myRating.get(r.id, viewerId)?.score ?? null,
});

// GET /api/requests/incoming
router.get('/incoming', (req, res) => {
  const rows = db.prepare(`${IN_SQL} WHERE i.owner_id = ? ORDER BY r.id DESC`).all(req.user.id);
  res.json(rows.map((r) => incoming(r, req.user.id)));
});

// GET /api/requests/stats  (lender dashboard numbers)
router.get('/stats', (req, res) => {
  const month = todayStr().slice(0, 7);
  const listed = db.prepare('SELECT COUNT(*) c FROM items WHERE owner_id = ?').get(req.user.id).c;
  const lentOut = db.prepare(`SELECT COUNT(*) c FROM requests r JOIN items i ON i.id = r.item_id
                              WHERE i.owner_id = ? AND r.status = 'accepted'`).get(req.user.id).c;
  const earned = db.prepare(`SELECT COALESCE(SUM(r.total_price),0) s FROM requests r JOIN items i ON i.id = r.item_id
                             WHERE i.owner_id = ? AND r.status IN ('accepted','returned') AND substr(r.date_from,1,7) = ?`)
    .get(req.user.id, month).s;
  res.json({ listed, lentOut, earned });
});

/* ---- state changes ---- */
const loadForUpdate = (req, res) => {
  const r = db.prepare('SELECT r.*, i.owner_id FROM requests r JOIN items i ON i.id = r.item_id WHERE r.id = ?').get(req.params.id);
  if (!r) { res.status(404).json({ error: 'Request not found.' }); return null; }
  return r;
};
const reply = (res, id, userId) => {
  const row = db.prepare(`${IN_SQL} WHERE r.id = ?`).get(id);
  res.json(incoming(row, userId));
};

// POST /api/requests/:id/accept  (lender)
router.post('/:id(\\d+)/accept', (req, res) => {
  const r = loadForUpdate(req, res); if (!r) return;
  if (r.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the lender can accept this request.' });
  if (r.status !== 'pending') return res.status(409).json({ error: `Request is already ${r.status}.` });
  if (overlapsAccepted(r.item_id, r.date_from, r.date_to, r.id)) return res.status(409).json({ error: 'Those dates overlap with a loan you already accepted.' });
  db.prepare("UPDATE requests SET status = 'accepted' WHERE id = ?").run(r.id);
  reply(res, r.id, req.user.id);
});

// POST /api/requests/:id/decline  (lender)
router.post('/:id(\\d+)/decline', (req, res) => {
  const r = loadForUpdate(req, res); if (!r) return;
  if (r.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the lender can decline this request.' });
  if (r.status !== 'pending') return res.status(409).json({ error: `Request is already ${r.status}.` });
  db.prepare("UPDATE requests SET status = 'declined' WHERE id = ?").run(r.id);
  reply(res, r.id, req.user.id);
});

// POST /api/requests/:id/return  (lender or borrower)
router.post('/:id(\\d+)/return', (req, res) => {
  const r = loadForUpdate(req, res); if (!r) return;
  if (r.owner_id !== req.user.id && r.borrower_id !== req.user.id) return res.status(403).json({ error: 'Not your request.' });
  if (r.status !== 'accepted') return res.status(409).json({ error: 'Only an accepted loan can be marked as returned.' });
  db.prepare("UPDATE requests SET status = 'returned', returned_at = datetime('now') WHERE id = ?").run(r.id);
  reply(res, r.id, req.user.id);
});

// POST /api/requests/:id/rate  { score: 1-10, comment? }  (each side rates the other, once)
router.post('/:id(\\d+)/rate', (req, res) => {
  const r = loadForUpdate(req, res); if (!r) return;
  const isLender = r.owner_id === req.user.id;
  if (!isLender && r.borrower_id !== req.user.id) return res.status(403).json({ error: 'Not your request.' });
  if (r.status !== 'returned') return res.status(409).json({ error: 'You can rate once the item has been returned.' });
  const score = Number(req.body.score);
  if (!Number.isInteger(score) || score < 1 || score > 10) return res.status(400).json({ error: 'Choose a score from 1 to 10.' });
  if (myRating.get(r.id, req.user.id)) return res.status(409).json({ error: 'You already rated this loan.' });

  const ratee = isLender ? r.borrower_id : r.owner_id;
  db.transaction(() => {
    db.prepare('INSERT INTO ratings (request_id, rater_id, ratee_id, score, comment) VALUES (?,?,?,?,?)')
      .run(r.id, req.user.id, ratee, score, String(req.body.comment ?? '').trim().slice(0, 140));
    db.prepare('UPDATE users SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?').run(score, ratee);
  })();
  const rateeRow = db.prepare('SELECT * FROM users WHERE id = ?').get(ratee);
  res.status(201).json({ rated: score, ratee: S.publicUser(rateeRow) });
});

module.exports = router;
