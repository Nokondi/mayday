export const publicUserSelect = {
  id: true,
  name: true,
  bio: true,
  location: true,
  skills: true,
  avatarUrl: true,
  createdAt: true,
} as const;

export const memberInclude = {
  user: { select: publicUserSelect },
} as const;
