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
  SPACES_ENDPOINT: z.string().optional(),
  SPACES_REGION: z.string().optional(),
  SPACES_KEY: z.string().optional(),
  SPACES_SECRET: z.string().optional(),
  SPACES_BUCKET: z.string().optional(),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export const env = envSchema.parse(process.env);

// Guardrail: in production, CLIENT_URL must be the real public domain.
// If it's left as the dev default, verification emails and CORS will be
// broken in ways that fail silently for users.
if (env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/i.test(env.CLIENT_URL)) {
  throw new Error(
    `CLIENT_URL must be set to the production domain when NODE_ENV=production (got ${env.CLIENT_URL}). ` +
    `Set CLIENT_URL=https://your-domain on the deployment and redeploy.`,
  );
}
