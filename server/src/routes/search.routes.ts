import { Router } from 'express';
import { prisma } from '../config/database.js';

export const searchRoutes = Router();

searchRoutes.get('/', async (req, res, next) => {
  try {
    const { q, type, category, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      res.json({ data: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 });
      return;
    }

    // Use PostgreSQL full-text search via raw query
    const searchQuery = q.trim().split(/\s+/).join(' & ');

    const typeFilter = type ? `AND "type" = '${type}'` : '';
    const categoryFilter = category ? `AND "category" = '${category}'` : '';
    const offset = (pageNum - 1) * limitNum;

    const data = await prisma.$queryRawUnsafe<any[]>(`
      SELECT p.*,
        ts_rank("searchVector", plainto_tsquery('english', $1)) as rank,
        json_build_object(
          'id', u.id, 'name', u.name, 'bio', u.bio,
          'location', u.location, 'skills', u.skills, 'createdAt', u."createdAt"
        ) as author
      FROM "Post" p
      JOIN "User" u ON p."authorId" = u.id
      WHERE "searchVector" @@ plainto_tsquery('english', $1)
        ${typeFilter} ${categoryFilter}
      ORDER BY rank DESC, p."createdAt" DESC
      LIMIT $2 OFFSET $3
    `, q, limitNum, offset);

    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT count(*) FROM "Post"
      WHERE "searchVector" @@ plainto_tsquery('english', $1)
        ${typeFilter} ${categoryFilter}
    `, q);

    const total = Number(countResult[0].count);

    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) { next(err); }
});
