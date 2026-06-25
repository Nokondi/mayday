import { Router } from "express";
import {
  createPostSchema,
  updatePostSchema,
  fulfillPostSchema,
} from "@mayday/shared";
import { validate } from "../middleware/validate.middleware.js";
import {
  requireAuth,
  type AuthRequest,
} from "../middleware/auth.middleware.js";
import { uploadPostImages } from "../middleware/upload.middleware.js";
import { prisma } from "../config/database.js";
import { deleteObjectByUrl } from "../config/storage.js";
import { AppError } from "../middleware/error.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { publicUserSelect } from "../utils/prisma-selects.js";
import { getFriendIds, areFriends } from "../services/friend.service.js";
import type { Prisma } from "@prisma/client";

export const postInclude = {
  author: {
    select: publicUserSelect,
  },
  organization: {
    select: { id: true, name: true, avatarUrl: true },
  },
  communities: {
    select: { community: { select: { id: true, name: true } } },
  },
  images: {
    select: { id: true, url: true, order: true },
    orderBy: { order: "asc" as const },
  },
  fulfillments: {
    select: {
      id: true,
      postId: true,
      name: true,
      userId: true,
      organizationId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
};

/** Returns the IDs of communities the user belongs to. */
async function getUserCommunityIds(userId: string): Promise<string[]> {
  const memberships = await prisma.communityMember.findMany({
    where: { userId },
    select: { communityId: true },
  });
  return memberships.map((m) => m.communityId);
}

/**
 * The visibility predicate for listing posts as `user`. A post is visible when
 * it is PUBLIC, authored by the user, a COMMUNITY post in one of the user's
 * communities, or a FRIENDS post by one of the user's friends. Returns
 * `undefined` for site ADMINs (who bypass visibility entirely) — callers should
 * skip adding a filter in that case.
 *
 * AND this into a query's `where` (don't assign it to `where.OR`, which would
 * clobber other OR-based filters).
 */
export async function getPostVisibilityFilter(
  user: { id: string; role: string },
): Promise<Prisma.PostWhereInput | undefined> {
  if (user.role === "ADMIN") return undefined;
  const [communityIds, friendIds] = await Promise.all([
    getUserCommunityIds(user.id),
    getFriendIds(user.id),
  ]);
  return {
    OR: [
      { authorId: user.id },
      // Public: no community scoping and not shared with friends.
      { communities: { none: {} }, sharedWithFriends: false },
      // Member of any of the post's communities.
      { communities: { some: { communityId: { in: communityIds } } } },
      // Shared with friends and authored by one of the viewer's friends.
      { sharedWithFriends: true, authorId: { in: friendIds } },
    ],
  };
}

/**
 * Whether `user` may view a single post. Mirrors getPostVisibilityFilter for
 * the by-id endpoints. Site ADMINs and the author always can.
 */
async function canViewPost(
  post: { authorId: string; sharedWithFriends: boolean },
  communityIds: string[],
  user: { id: string; role: string },
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (post.authorId === user.id) return true;
  // Public when neither audience restriction applies.
  if (communityIds.length === 0 && !post.sharedWithFriends) return true;
  // Member of any of the post's communities.
  if (communityIds.length > 0) {
    const membership = await prisma.communityMember.findFirst({
      where: { userId: user.id, communityId: { in: communityIds } },
    });
    if (membership) return true;
  }
  // Friend of the author on a friends-shared post.
  if (post.sharedWithFriends && (await areFriends(user.id, post.authorId))) {
    return true;
  }
  return false;
}

/**
 * Flatten the PostCommunity join rows (as loaded by `postInclude`) into the
 * `communities: [{ id, name }]` shape the API contract exposes. A null input
 * (e.g. a missing findUnique result) passes straight through.
 */
export function serializePost<
  T extends { communities: { community: { id: string; name: string } }[] },
>(post: T | null) {
  if (!post) return null;
  return { ...post, communities: post.communities.map((pc) => pc.community) };
}

/**
 * A user can modify a post if they are:
 *   - the original author
 *   - an ADMIN (site-wide)
 *   - an OWNER or ADMIN of the post's organization (for org posts)
 */
async function canModifyPost(
  post: { authorId: string; organizationId: string | null },
  user: { id: string; role: string },
): Promise<boolean> {
  if (post.authorId === user.id) return true;
  if (user.role === "ADMIN") return true;
  if (post.organizationId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: post.organizationId,
          userId: user.id,
        },
      },
    });
    if (
      membership &&
      (membership.role === "OWNER" || membership.role === "ADMIN")
    ) {
      return true;
    }
  }
  return false;
}

export const postRoutes = Router();

postRoutes.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      type,
      category,
      status,
      urgency,
      q,
      neLat,
      neLng,
      swLat,
      swLng,
      page = "1",
      limit = "20",
      sort = "recent",
      communityId,
      friends,
      scheduled,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

    const where: Prisma.PostWhereInput = {};
    if (type && ["REQUEST", "OFFER"].includes(type as string))
      where.type = type as "REQUEST" | "OFFER";
    if (category) where.category = category as string;
    if (status && ["OPEN", "FULFILLED", "CLOSED"].includes(status as string))
      where.status = status as "OPEN" | "FULFILLED" | "CLOSED";
    if (
      urgency &&
      ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(urgency as string)
    )
      where.urgency = urgency as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    if (scheduled === "true") where.startAt = { not: null };

    if (neLat && neLng && swLat && swLng) {
      where.latitude = {
        gte: parseFloat(swLat as string),
        lte: parseFloat(neLat as string),
      };
      where.longitude = {
        gte: parseFloat(swLng as string),
        lte: parseFloat(neLng as string),
      };
    }

    // Text search (AND'd with other filters)
    if (q) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { title: { contains: q as string, mode: "insensitive" } },
            { description: { contains: q as string, mode: "insensitive" } },
          ],
        },
      ];
    }

    // Optionally narrow to a specific community…
    if (typeof communityId === "string" && communityId) {
      where.communities = { some: { communityId } };
    }
    // …or narrow to posts friends have shared with the viewer.
    if (friends === "true") {
      const friendIds = await getFriendIds(req.user!.id);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { sharedWithFriends: true, authorId: { in: friendIds } },
      ];
    }
    // …and always enforce visibility (PUBLIC / own / member-COMMUNITY / FRIENDS),
    // except for site ADMINs who see everything. AND'd so it composes with the
    // text-search OR above and the optional community/friends narrowing.
    const visibilityFilter = await getPostVisibilityFilter(req.user!);
    if (visibilityFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        visibilityFilter,
      ];
    }

    const orderBy: Prisma.PostOrderByWithRelationInput =
      sort === "urgency" ? { urgency: "desc" } : { createdAt: "desc" };

    const [data, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: postInclude,
        orderBy,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.post.count({ where }),
    ]);

    res.json({
      data: data.map(serializePost),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  }),
);

postRoutes.get(
  "/fulfiller-search",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const q = req.query.q;
    if (typeof q !== "string" || q.length < 2) {
      res.json({ users: [], organizations: [] });
      return;
    }

    const [users, organizations] = await Promise.all([
      prisma.user.findMany({
        where: { name: { contains: q, mode: "insensitive" }, isBanned: false },
        select: { id: true, name: true, avatarUrl: true },
        take: 5,
      }),
      prisma.organization.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, avatarUrl: true },
        take: 5,
      }),
    ]);

    res.json({ users, organizations });
  }),
);

postRoutes.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id as string },
      include: postInclude,
    });
    if (!post) throw new AppError(404, "Post not found");

    const canView = await canViewPost(
      post,
      post.communities.map((pc) => pc.community.id),
      req.user!,
    );
    if (!canView) {
      throw new AppError(403, "You don't have access to this post");
    }

    res.json(serializePost(post));
  }),
);

postRoutes.get(
  "/:id/matches",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id as string },
      include: { communities: { select: { communityId: true } } },
    });
    if (!post) throw new AppError(404, "Post not found");

    // The viewer must be able to see the source post.
    const canView = await canViewPost(
      post,
      post.communities.map((pc) => pc.communityId),
      req.user!,
    );
    if (!canView) {
      throw new AppError(403, "You don't have access to this post");
    }

    const matchType = post.type === "REQUEST" ? "OFFER" : "REQUEST";
    const where: Prisma.PostWhereInput = {
      type: matchType,
      category: post.category,
      status: "OPEN",
      id: { not: post.id },
      authorId: { not: req.user!.id },
    };

    if (post.latitude && post.longitude) {
      const radiusInDegrees = 0.45; // ~50km
      where.latitude = {
        gte: post.latitude - radiusInDegrees,
        lte: post.latitude + radiusInDegrees,
      };
      where.longitude = {
        gte: post.longitude - radiusInDegrees,
        lte: post.longitude + radiusInDegrees,
      };
    }

    // Only surface matches the viewer is allowed to see.
    const visibilityFilter = await getPostVisibilityFilter(req.user!);
    if (visibilityFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        visibilityFilter,
      ];
    }

    const matches = await prisma.post.findMany({
      where,
      include: postInclude,
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
      take: 10,
    });

    res.json(matches.map(serializePost));
  }),
);

// Create post with optional image uploads (multipart/form-data)
postRoutes.post(
  "/",
  requireAuth,
  uploadPostImages,
  asyncHandler(async (req: AuthRequest, res) => {
    // When using multipart, form fields come as strings — parse them
    const body = { ...req.body };

    // Parse numeric fields that arrive as strings from FormData
    if (body.latitude) body.latitude = parseFloat(body.latitude);
    if (body.longitude) body.longitude = parseFloat(body.longitude);

    // Validate the parsed body
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(", ");
      throw new AppError(400, message);
    }

    // If posting on behalf of an organization, verify membership
    if (parsed.data.organizationId) {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: parsed.data.organizationId,
            userId: req.user!.id,
          },
        },
      });
      if (!membership) {
        throw new AppError(403, "You are not a member of this organization");
      }
    }

    const { communityIds, sharedWithFriends, startAt, endAt, ...postData } =
      parsed.data;
    const uniqueCommunityIds = [...new Set(communityIds ?? [])];

    // If scoping to communities, the author must belong to every one of them.
    if (uniqueCommunityIds.length > 0) {
      const memberships = await prisma.communityMember.findMany({
        where: { userId: req.user!.id, communityId: { in: uniqueCommunityIds } },
        select: { communityId: true },
      });
      const memberOf = new Set(memberships.map((m) => m.communityId));
      if (uniqueCommunityIds.some((id) => !memberOf.has(id))) {
        throw new AppError(403, "You are not a member of this community");
      }
    }

    const post = await prisma.post.create({
      data: {
        ...postData,
        sharedWithFriends: sharedWithFriends ?? false,
        startAt: startAt ? new Date(startAt) : undefined,
        endAt: endAt ? new Date(endAt) : undefined,
        authorId: req.user!.id,
        communities:
          uniqueCommunityIds.length > 0
            ? { create: uniqueCommunityIds.map((communityId) => ({ communityId })) }
            : undefined,
      },
    });

    // Create PostImage records for uploaded files
    const files = (req.files as Express.MulterS3.File[]) || [];
    if (files.length > 0) {
      await prisma.postImage.createMany({
        data: files.map((file, index) => ({
          postId: post.id,
          url: file.location,
          order: index,
        })),
      });
    }

    // Re-fetch with includes
    const fullPost = await prisma.post.findUnique({
      where: { id: post.id },
      include: postInclude,
    });

    res.status(201).json(serializePost(fullPost));
  }),
);

// Edit a post, with optional image add/remove (multipart/form-data). Text
// fields and new image files arrive in the same request; `removeImageIds`
// lists existing images to drop. Audience (org/community/friends) is fixed at
// creation and cannot be changed here.
postRoutes.put(
  "/:id",
  requireAuth,
  uploadPostImages,
  asyncHandler(async (req: AuthRequest, res) => {
    const files = (req.files as Express.MulterS3.File[]) || [];
    // Clean up freshly-uploaded objects when we bail before persisting them.
    const cleanupUploads = async () => {
      for (const file of files) {
        await deleteObjectByUrl(file.location).catch(() => {});
      }
    };

    const existing = await prisma.post.findUnique({
      where: { id: req.params.id as string },
      include: { images: true },
    });
    if (!existing) {
      await cleanupUploads();
      throw new AppError(404, "Post not found");
    }
    if (!(await canModifyPost(existing, req.user!))) {
      await cleanupUploads();
      throw new AppError(403, "Not authorized");
    }

    // Multipart sends every field as a string — parse the numeric ones so the
    // schema (which expects real numbers) validates them.
    const body = { ...req.body };
    if (body.latitude) body.latitude = parseFloat(body.latitude);
    if (body.longitude) body.longitude = parseFloat(body.longitude);

    const parsed = updatePostSchema.safeParse(body);
    if (!parsed.success) {
      await cleanupUploads();
      const message = parsed.error.errors.map((e) => e.message).join(", ");
      throw new AppError(400, message);
    }

    // Images to remove — accept a single id or repeated fields, and keep only
    // ids that actually belong to this post.
    const rawRemove = req.body.removeImageIds;
    const removeIds: string[] = Array.isArray(rawRemove)
      ? rawRemove
      : rawRemove
        ? [rawRemove]
        : [];
    const removable = existing.images.filter((img) => removeIds.includes(img.id));

    // Enforce the same 5-image cap as creation, counting images that survive
    // this edit plus the new uploads.
    const remainingCount = existing.images.length - removable.length;
    if (remainingCount + files.length > 5) {
      await cleanupUploads();
      throw new AppError(400, "A post can have at most 5 images");
    }

    // Audience is fixed at creation: don't let an edit change the org/community
    // link or the friends-sharing flag.
    const {
      organizationId: _ignoreOrg,
      communityIds: _ignoreCommunities,
      sharedWithFriends: _ignoreSharedWithFriends,
      ...updateData
    } = parsed.data;

    const data: Prisma.PostUpdateInput = { ...updateData };
    if (updateData.startAt) data.startAt = new Date(updateData.startAt);
    if (updateData.endAt) data.endAt = new Date(updateData.endAt);

    // New images sort after whatever already exists.
    const baseOrder = existing.images.reduce(
      (max, img) => Math.max(max, img.order + 1),
      0,
    );

    const post = await prisma.$transaction(async (tx) => {
      if (removable.length > 0) {
        await tx.postImage.deleteMany({
          where: { id: { in: removable.map((img) => img.id) } },
        });
      }
      await tx.post.update({
        where: { id: req.params.id as string },
        data,
      });
      if (files.length > 0) {
        await tx.postImage.createMany({
          data: files.map((file, index) => ({
            postId: req.params.id as string,
            url: file.location,
            order: baseOrder + index,
          })),
        });
      }
      return tx.post.findUnique({
        where: { id: req.params.id as string },
        include: postInclude,
      });
    });

    // Delete removed image files from storage only after the DB commit.
    for (const img of removable) {
      await deleteObjectByUrl(img.url).catch(() => {});
    }

    res.json(serializePost(post));
  }),
);

postRoutes.post(
  "/:id/fulfill",
  requireAuth,
  validate(fulfillPostSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.post.findUnique({
      where: { id: req.params.id as string },
    });
    if (!existing) throw new AppError(404, "Post not found");
    if (!(await canModifyPost(existing, req.user!))) {
      throw new AppError(403, "Not authorized");
    }
    if (existing.status !== "OPEN") {
      throw new AppError(400, "Only open posts can be marked as fulfilled");
    }

    const { fulfillers } = req.body;

    const post = await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: req.params.id as string },
        data: { status: "FULFILLED" },
      });

      await tx.postFulfillment.createMany({
        data: fulfillers.map(
          (f: { name: string; userId?: string; organizationId?: string }) => ({
            postId: req.params.id as string,
            name: f.name,
            userId: f.userId || null,
            organizationId: f.organizationId || null,
          }),
        ),
      });

      return tx.post.findUnique({
        where: { id: req.params.id as string },
        include: postInclude,
      });
    });

    res.json(serializePost(post));
  }),
);

postRoutes.post(
  "/:id/reopen",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.post.findUnique({
      where: { id: req.params.id as string },
    });
    if (!existing) throw new AppError(404, "Post not found");
    if (!(await canModifyPost(existing, req.user!))) {
      throw new AppError(403, "Not authorized");
    }
    if (existing.status !== "FULFILLED") {
      throw new AppError(400, "Only fulfilled posts can be reopened");
    }

    const post = await prisma.$transaction(async (tx) => {
      await tx.postFulfillment.deleteMany({
        where: { postId: { equals: req.params.id as string } },
      });
      return tx.post.update({
        where: { id: req.params.id as string },
        data: { status: "OPEN" },
        include: postInclude,
      });
    });

    res.json(serializePost(post));
  }),
);

postRoutes.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.post.findUnique({
      where: { id: req.params.id as string },
      include: { images: true },
    });
    if (!existing) throw new AppError(404, "Post not found");
    if (!(await canModifyPost(existing, req.user!))) {
      throw new AppError(403, "Not authorized");
    }

    // Delete image files from Spaces
    for (const image of existing.images) {
      await deleteObjectByUrl(image.url).catch(() => {});
    }

    await prisma.post.delete({ where: { id: req.params.id as string } });
    res.json({ message: "Post deleted" });
  }),
);

// Delete a single image from a post
postRoutes.delete(
  "/:postId/images/:imageId",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const image = await prisma.postImage.findUnique({
      where: { id: req.params.imageId as string },
      include: { post: true },
    });
    if (!image) throw new AppError(404, "Image not found");
    if (!(await canModifyPost(image.post, req.user!))) {
      throw new AppError(403, "Not authorized");
    }

    // Delete file from Spaces
    await deleteObjectByUrl(image.url).catch(() => {});

    await prisma.postImage.delete({ where: { id: image.id } });
    res.json({ message: "Image deleted" });
  }),
);
