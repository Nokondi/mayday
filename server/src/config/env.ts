import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env from project root (parent of server/)
dotenv.config({ path: '../.env' });

const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  SPACES_ENDPOINT: z.string(),
  SPACES_REGION: z.string(),
  SPACES_KEY: z.string(),
  SPACES_SECRET: z.string(),
  SPACES_BUCKET: z.string(),
});

export const env = envSchema.parse(process.env);
