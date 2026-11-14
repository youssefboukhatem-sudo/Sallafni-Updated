// Demo data. Run automatically on first start when the DB is empty.
//   npm run seed    -> add demo data if DB is empty
//   npm run reset   -> wipe everything and re-seed
const bcrypt = require('bcryptjs');
const db = require('./db');

const PASSWORD = 'password123';
const iso = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function seed({ reset = false } = {}) {
  if (reset) {
    db.exec('DELETE FROM ratings; DELETE FROM requests; DELETE FROM items; DELETE FROM users; DELETE FROM sqlite_sequence;');
  }
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return false;
  const hash = bcrypt.hashSync(PASSWORD, 10);

  const addUser = db.prepare(`INSERT INTO users
    (email, password_hash, first_name, last_name, phone, street, city, area, lat, lng, rating_sum, rating_count)
    VALUES (@email, @hash, @fn, @ln, @phone, @street, @city, @area, @lat, @lng, @sum, @n)`);
  const u = (fn, ln, city, area, street, lat, lng, sum, n) =>
    addUser.run({ email: `${fn.toLowerCase()}@sallafni.tn`, hash, fn, ln, phone: '+216 20 000 000', street, city, area, lat, lng, sum, n }).lastInsertRowid;

  const tx = db.transaction(() => {
    // The demo account you log in with
    const amine = addUser.run({ email: 'demo@sallafni.tn', hash, fn: 'Amine', ln: 'Ben Salah', phone: '+216 22 123 456',
      street: '14 Rue de Marseille', city: 'Tunis', area: 'Centre Ville', lat: 36.8065, lng: 10.1815, sum: 0, n: 0 }).lastInsertRowid;

    const chris = u('Chris', 'Martin', 'Tunis', 'Lac 2', '12 Rue du Lac Malaren', 36.8, 10.2, 174, 20);
    const zeb = u('Zeb', 'Haddad', 'Ariana', 'Ennasr', '8 Avenue Hedi Nouira', 36.8665, 10.1647, 96, 11);
    const lina = u('Lina', 'Trabelsi', 'La Marsa', 'Gammarth', '21 Rue des Jasmins', 36.8782, 10.3247, 187, 21);
    const daan = u('Daan', 'Visser', 'Sousse', 'Khezama', '5 Rue de la Corniche', 35.8256, 10.6084, 62, 8);
    const jeff = u('Jeff', 'Ali', 'Sfax', 'Route de Tunis', '3 Rue Ali Bach Hamba', 34.7406, 10.7603, 140, 19);
    const sara = u('Sara', 'Gharbi', 'Tunis', 'El Menzah', '2 Rue de Carthage', 36.83, 10.17, 91, 10);
    const karim = u('Karim', 'Jlassi', 'Tunis', 'Bardo', '9 Rue Ibn Khaldoun', 36.81, 10.14, 74, 10);
    const mehdi = u('Mehdi', 'Chaabane', 'Ariana', 'Soukra', '4 Rue des Oliviers', 36.87, 10.23, 81, 10);
    const ons = u('Ons', 'Mansour', 'Tunis', 'Lafayette', '6 Rue de Hollande', 36.81, 10.18, 56, 6);

    const addItem = db.prepare('INSERT INTO items (owner_id, name, description, category, price, condition) VALUES (?,?,?,?,?,?)');
    const drill = addItem.run(amine, 'Power drill', 'Cordless, with 2 batteries', 'Tools', 0, 'Good').lastInsertRowid;
    const tent = addItem.run(amine, 'Camping tent', '3 person, waterproof', 'Outdoor', 0, 'Like new').lastInsertRowid;
    addItem.run(amine, 'Ladder', 'Aluminium, 3 m', 'Tools', 5, 'Good');
    const truck = addItem.run(chris, 'Hand truck', 'Folds flat', 'Tools', 0, 'Good').lastInsertRowid;
    addItem.run(lina, 'BMX bike', '20-inch, black', 'Bikes', 8, 'Good');
    const pump = addItem.run(lina, 'Bike pump', 'Floor pump with gauge', 'Bikes', 0, 'Good').lastInsertRowid;
    const ipad = addItem.run(daan, 'iPad Pro', 'With keyboard', 'Electronics', 25, 'Like new').lastInsertRowid;
    addItem.run(jeff, 'BBQ grill', 'Charcoal, with tools', 'Party gear', 10, 'Fair');
    addItem.run(zeb, 'Folding table', 'Seats 6, good for parties', 'Party gear', 0, 'Good');

    const addReq = db.prepare(`INSERT INTO requests (item_id, borrower_id, date_from, date_to, note, status, total_price, returned_at)
                               VALUES (@item, @who, @from, @to, @note, @st, @total, @ret)`);
    const r = (o) => addReq.run({ note: '', total: 0, ret: null, ...o }).lastInsertRowid;

    // Amine as borrower
    r({ item: truck, who: amine, from: iso(-1), to: iso(5), note: 'Moving boxes', st: 'accepted' });
    r({ item: ipad, who: amine, from: iso(3), to: iso(5), note: '', st: 'pending', total: 75 });
    r({ item: pump, who: amine, from: iso(-20), to: iso(-18), st: 'returned', ret: iso(-18) });
    // Amine as lender
    r({ item: drill, who: sara, from: iso(2), to: iso(3), note: 'Hanging shelves', st: 'pending' });
    r({ item: tent, who: karim, from: iso(6), to: iso(9), note: 'Weekend trip', st: 'pending' });
    r({ item: drill, who: mehdi, from: iso(-15), to: iso(-14), st: 'returned', ret: iso(-14) });
    const tentLoan = r({ item: tent, who: ons, from: iso(-25), to: iso(-23), st: 'returned', ret: iso(-23) });
    db.prepare('INSERT INTO ratings (request_id, rater_id, ratee_id, score, comment) VALUES (?,?,?,?,?)').run(tentLoan, amine, ons, 8, 'Returned on time');
    db.prepare('UPDATE users SET rating_sum = rating_sum + 8, rating_count = rating_count + 1 WHERE id = ?').run(ons);
  });
  tx();
  return true;
}

module.exports = { seed, PASSWORD };

if (require.main === module) {
  const did = seed({ reset: process.argv.includes('--reset') });
  console.log(did ? `Seeded demo data. Log in with demo@sallafni.tn / ${PASSWORD}` : 'Database already has data (use "npm run reset" to wipe and re-seed).');
}
