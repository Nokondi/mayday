import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '../../src/middleware/error.middleware.js';
import { validate } from '../../src/middleware/validate.middleware.js';

const schema = z.object({
  name: z.string().min(1, 'name is required'),
  age: z.number().int().nonnegative('age must be non-negative'),
});

function makeReqRes(body: unknown) {
  const req = { body } as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validate middleware', () => {
  it('calls next() with no arguments when the body matches the schema', () => {
    const { req, res, next } = makeReqRes({ name: 'A', age: 1 });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('replaces req.body with the parsed (coerced & stripped) data', () => {
    const strictSchema = z.object({ age: z.coerce.number() });
    const { req, res, next } = makeReqRes({ age: '42', extra: 'x' });
    validate(strictSchema)(req, res, next);
    // Number-coerced and with extra property stripped.
    expect(req.body).toEqual({ age: 42 });
    expect(next).toHaveBeenCalled();
  });

  it('throws an AppError(400) for invalid bodies', () => {
    const { req, res, next } = makeReqRes({ name: '', age: -1 });
    expect(() => validate(schema)(req, res, next)).toThrow(AppError);
    try {
      validate(schema)(req, res, next);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it('joins multiple validation messages with ", "', () => {
    const { req, res, next } = makeReqRes({ name: '', age: -5 });
    try {
      validate(schema)(req, res, next);
      throw new Error('expected throw');
    } catch (err) {
      expect((err as AppError).message).toContain('name is required');
      expect((err as AppError).message).toContain('age must be non-negative');
      expect((err as AppError).message).toContain(', ');
    }
  });

  it('does not call next() when validation fails', () => {
    const { req, res, next } = makeReqRes({ name: '', age: -1 });
    expect(() => validate(schema)(req, res, next)).toThrow();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not mutate req.body on failure', () => {
    const original = { name: '', age: -1 };
    const { req, res, next } = makeReqRes(original);
    expect(() => validate(schema)(req, res, next)).toThrow();
    expect(req.body).toBe(original);
  });

  it('surfaces an error for a missing body (req.body === undefined)', () => {
    const { req, res, next } = makeReqRes(undefined);
    expect(() => validate(schema)(req, res, next)).toThrow(AppError);
  });
});
