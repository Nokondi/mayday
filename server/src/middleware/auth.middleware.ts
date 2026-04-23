import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../config/database.js';
import { AppError } from './error.middleware.js';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Authentication required');
  }

  const token = header.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    throw new AppError(401, 'Invalid or expired token');
  }

  req.user = payload;
  next();
}

export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    throw new AppError(403, 'Admin access required');
  }
  next();
}

/**
 * Rejects requests from banned users OR from users whose record no longer
 * exists (e.g. account was deleted but the access token is still within its
 * 15-minute TTL). Apply after requireAuth.
 */
export async function rejectBanned(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { isBanned: true },
    });
    if (!user) {
      throw new AppError(401, 'Account no longer exists');
    }
    if (user.isBanned) {
      throw new AppError(403, 'Your account has been suspended');
    }
    next();
  } catch (err) { next(err); }
}
