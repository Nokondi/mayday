import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, errorMiddleware } from '../../src/middleware/error.middleware.js';

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('AppError', () => {
  it('stores the status code and message', () => {
    const err = new AppError(404, 'Not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
  });

  it('is an Error with a distinctive name', () => {
    const err = new AppError(400, 'Bad');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AppError');
  });

  it('captures a stack trace', () => {
    const err = new AppError(500, 'Oops');
    expect(err.stack).toContain('AppError');
  });
});

describe('errorMiddleware', () => {
  const next = vi.fn() as unknown as NextFunction;
  const req = {} as Request;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('responds with the AppError status and message', () => {
    const res = makeRes();
    errorMiddleware(new AppError(404, 'Not found'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('preserves different AppError status codes', () => {
    const res = makeRes();
    errorMiddleware(new AppError(409, 'Conflict'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Conflict' });
  });

  it('returns a generic 500 for unknown errors and does not leak the message', () => {
    const res = makeRes();
    errorMiddleware(new Error('Database exploded: secret=abc'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('logs non-AppError errors to console.error', () => {
    const res = makeRes();
    const err = new Error('boom');
    errorMiddleware(err, req, res, next);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unhandled error:', err);
  });

  it('does not log AppErrors (expected, user-safe errors)', () => {
    const res = makeRes();
    errorMiddleware(new AppError(400, 'Bad input'), req, res, next);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('does not invoke next — this middleware terminates the chain', () => {
    const res = makeRes();
    errorMiddleware(new AppError(400, 'Bad'), req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});
