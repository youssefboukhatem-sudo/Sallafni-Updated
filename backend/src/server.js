const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
require('./db');
require('./seed').seed();

const app = express();
app.use(cors({ origin: config.CORS_ORIGIN.split(','), credentials: false }));
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(config.UPLOAD_DIR, { maxAge: '7d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/users', require('./routes/users'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// Optional: serve the built Angular app from the same server (npm run build in the root, then npm start here)
const dist = path.resolve(__dirname, '..', '..', 'dist', 'sallafni', 'browser');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

if (require.main === module) {
  app.listen(config.PORT, () => console.log(`Sallafni API listening on http://localhost:${config.PORT}`));
}
module.exports = app;
