import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './error.middleware.js';

export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map(e => e.message).join(', ');
      throw new AppError(400, message);
    }
    req.body = result.data;
    next();
  };
}
