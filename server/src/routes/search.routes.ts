import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const VALID_TYPES = ['REQUEST', 'OFFER', 'EVENT'];
const VALID_CATEGORIES = [
  'Food', 'Housing', 'Transportation', 'Healthcare', 'Legal Aid',
  'Childcare', 'Education', 'Employment', 'Clothing', 'Household Items',
  'Emotional Support', 'Other',
];

export const searchRoutes = Router();

searchRoutes.use(requireAuth);

searchRoutes.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const { q, type, category, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
  const viewerId = req.user!.id;
  const isAdmin = req.user!.role === 'ADMIN';

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

  // Visibility: only return posts the viewer may see — their own, a public post
  // (no communities and not shared with friends), a post in one of their
  // communities, or a friends-shared post by a friend. Site ADMINs bypass this.
  // The single viewer param is referenced several times.
  if (!isAdmin) {
    const v = `$${paramIndex}`;
    conditions.push(`(
      p."authorId" = ${v}
      OR (p."sharedWithFriends" = false AND NOT EXISTS (
        SELECT 1 FROM "PostCommunity" pc WHERE pc."postId" = p.id))
      OR EXISTS (
        SELECT 1 FROM "PostCommunity" pc
        JOIN "CommunityMember" cm ON cm."communityId" = pc."communityId"
        WHERE pc."postId" = p.id AND cm."userId" = ${v})
      OR (p."sharedWithFriends" = true AND EXISTS (
        SELECT 1 FROM "Friendship" f
        WHERE (f."userAId" = p."authorId" AND f."userBId" = ${v})
           OR (f."userBId" = p."authorId" AND f."userAId" = ${v})))
    )`);
    params.push(viewerId);
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
    SELECT count(*) FROM "Post" p
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
