const path = require('path');
const fs = require('fs');

// Tiny .env loader (no extra dependency)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  DB_FILE: path.resolve(__dirname, '..', process.env.DB_FILE || './data/sallafni.db'),
  UPLOAD_DIR: path.resolve(__dirname, '..', 'uploads'),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:4200',
};
