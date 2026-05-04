import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const VALID_TYPES = ['REQUEST', 'OFFER'];
const VALID_CATEGORIES = [
  'Food', 'Housing', 'Transportation', 'Healthcare', 'Legal Aid',
  'Childcare', 'Education', 'Employment', 'Clothing', 'Household Items',
  'Emotional Support', 'Other',
];

export const searchRoutes = Router();

searchRoutes.use(requireAuth);

searchRoutes.get('/', asyncHandler(async (req, res) => {
  const { q, type, category, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    res.json({ data: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 });
    return;
  }

  // Validate type and category against allowlists
  const safeType = (typeof type === 'string' && VALID_TYPES.includes(type)) ? type : null;
  const safeCategory = (typeof category === 'string' && VALID_CATEGORIES.includes(category)) ? category : null;

  const offset = (pageNum - 1) * limitNum;

  // Build parameterized query dynamically
  const conditions: string[] = ['"searchVector" @@ plainto_tsquery(\'english\', $1)'];
  const params: (string | number)[] = [q];
  let paramIndex = 2;

  if (safeType) {
    conditions.push(`"type" = $${paramIndex}`);
    params.push(safeType);
    paramIndex++;
  }
  if (safeCategory) {
    conditions.push(`"category" = $${paramIndex}`);
    params.push(safeCategory);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const limitParam = `$${paramIndex}`;
  params.push(limitNum);
  paramIndex++;
  const offsetParam = `$${paramIndex}`;
  params.push(offset);

  const data = await prisma.$queryRawUnsafe<any[]>(`
    SELECT p.*,
      ts_rank("searchVector", plainto_tsquery('english', $1)) as rank,
      json_build_object(
        'id', u.id, 'name', u.name, 'bio', u.bio,
        'location', u.location, 'skills', u.skills, 'createdAt', u."createdAt"
      ) as author
    FROM "Post" p
    JOIN "User" u ON p."authorId" = u.id
    WHERE ${whereClause}
    ORDER BY rank DESC, p."createdAt" DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `, ...params);

  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
    SELECT count(*) FROM "Post"
    WHERE ${whereClause}
  `, ...params.slice(0, -2)); // exclude LIMIT/OFFSET params

  const total = Number(countResult[0].count);

  res.json({
    data,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
}));
