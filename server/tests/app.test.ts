import request from 'supertest';
import { createApp } from '../src/app.js';

describe('createApp', () => {
  it('exposes a working /api/health endpoint', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 404 for unknown API routes', async () => {
    const app = createApp();
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
