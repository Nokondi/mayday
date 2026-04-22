import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { searchRoutes } from '../../src/routes/search.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedQueryRaw = vi.mocked(prisma.$queryRawUnsafe);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/search', searchRoutes);
  app.use(errorMiddleware);
  return app;
}

const authHeader = () =>
  `Bearer ${signAccessToken({ id: 'u1', email: 'a@b.com', role: 'USER' })}`;

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('GET /api/search', () => {
  it('returns posts ranked by fulltext match, with pagination meta', async () => {
    mockedQueryRaw
      .mockResolvedValueOnce([{ id: 'p1', title: 'Need food' }] as never)
      .mockResolvedValueOnce([{ count: 1n }] as never);

    const res = await request(makeApp())
      .get('/api/search?q=food')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.totalPages).toBe(1);
  });

  it('returns an empty result set when q is missing or blank', async () => {
    const res = await request(makeApp())
      .get('/api/search?q=')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [], total: 0, totalPages: 0 });
    expect(mockedQueryRaw).not.toHaveBeenCalled();
  });

  it('passes the query string as the first bound parameter (not interpolated)', async () => {
    mockedQueryRaw
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0n }] as never);

    await request(makeApp())
      .get("/api/search?q=robert'); DROP TABLE users;--")
      .set('Authorization', authHeader());

    const [, ...params] = mockedQueryRaw.mock.calls[0];
    expect(params[0]).toBe("robert'); DROP TABLE users;--");
  });

  it('applies type filter only when the value is in the allowlist', async () => {
    mockedQueryRaw
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0n }] as never);

    await request(makeApp())
      .get('/api/search?q=help&type=REQUEST')
      .set('Authorization', authHeader());

    const [sql, ...params] = mockedQueryRaw.mock.calls[0];
    expect(String(sql)).toContain('"type"');
    expect(params).toContain('REQUEST');
  });

  it('ignores an invalid type value', async () => {
    mockedQueryRaw
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0n }] as never);

    await request(makeApp())
      .get('/api/search?q=help&type=INVALID')
      .set('Authorization', authHeader());

    const [sql, ...params] = mockedQueryRaw.mock.calls[0];
    expect(String(sql)).not.toContain('"type"');
    expect(params).not.toContain('INVALID');
  });

  it('applies category filter only when the value is in the allowlist', async () => {
    mockedQueryRaw
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0n }] as never);

    await request(makeApp())
      .get('/api/search?q=help&category=Food')
      .set('Authorization', authHeader());

    const [sql, ...params] = mockedQueryRaw.mock.calls[0];
    expect(String(sql)).toContain('"category"');
    expect(params).toContain('Food');
  });

  it('requires authentication', async () => {
    const res = await request(makeApp()).get('/api/search?q=food');
    expect(res.status).toBe(401);
  });
});
