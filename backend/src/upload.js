// Shared image-upload helper (items use 5 MB photos, avatars use 2 MB).
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { UPLOAD_DIR } = require('./config');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const imageUpload = (maxMb) =>
  multer({
    storage: multer.diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[file.mimetype]),
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
      cb(EXT[file.mimetype] ? null : new Error('Please choose a JPG, PNG, WebP or GIF image.'), Boolean(EXT[file.mimetype])),
  });

/** Delete a stored file given the "/uploads/<name>" path kept in the DB (ignores missing files). */
const removeUpload = (urlPath) => {
  if (urlPath) fs.unlink(path.join(UPLOAD_DIR, path.basename(urlPath)), () => {});
};

module.exports = { imageUpload, removeUpload };
