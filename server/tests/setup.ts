// Provide safe dummy values for env-gated config so the app can be imported
// during tests without requiring a real .env. These must be set before any
// module that reads process.env (e.g. ../config/env.ts) is imported.

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-at-least-32-chars';
process.env.SPACES_ENDPOINT = 'https://example.com';
process.env.SPACES_REGION = 'us-east-1';
process.env.SPACES_KEY = 'test-key';
process.env.SPACES_SECRET = 'test-secret';
process.env.SPACES_BUCKET = 'test-bucket';
process.env.CLIENT_URL = 'http://localhost:5173';
