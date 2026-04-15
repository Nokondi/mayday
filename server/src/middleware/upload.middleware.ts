import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import crypto from 'crypto';
import { s3Client } from '../config/storage.js';
import { env } from '../config/env.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
  }
};

function makeS3Storage(folder: string) {
  return multerS3({
    s3: s3Client,
    bucket: env.SPACES_BUCKET,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${folder}/${crypto.randomUUID()}${ext}`);
    },
  });
}

export const uploadPostImages = multer({
  storage: makeS3Storage('post_images'),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5,
  },
}).array('images', 5);

export const uploadAvatar = multer({
  storage: makeS3Storage('avatars'),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).single('avatar');
