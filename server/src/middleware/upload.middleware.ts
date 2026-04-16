import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { s3Client } from "../config/storage.js";
import { env } from "../config/env.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const POST_IMAGES_DIRECTORY =
  env.NODE_ENV === "production" ? "post_images" : "post_images_dev";
const AVATARS_DIRECTORY =
  env.NODE_ENV === "production" ? "avatars" : "avatars_dev";

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
  }
};

function makeS3Storage(folder: string) {
  return multerS3({
    s3: s3Client,
    bucket: env.SPACES_BUCKET!,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${folder}/${crypto.randomUUID()}${ext}`);
    },
  });
}

function lazyUpload(
  factory: () => multer.Multer,
  method: "array" | "single",
  field: string,
  maxCount?: number,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!s3Client || !env.SPACES_BUCKET) {
      next(
        new Error(
          "File uploads require SPACES_* environment variables to be configured",
        ),
      );
      return;
    }
    const handler =
      method === "array"
        ? factory().array(field, maxCount)
        : factory().single(field);
    handler(req, res, next);
  };
}

export const uploadPostImages = lazyUpload(
  () =>
    multer({
      storage: makeS3Storage(POST_IMAGES_DIRECTORY),
      fileFilter,
      limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    }),
  "array",
  "images",
  5,
);

export const uploadAvatar = lazyUpload(
  () =>
    multer({
      storage: makeS3Storage(AVATARS_DIRECTORY),
      fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  "single",
  "avatar",
);
