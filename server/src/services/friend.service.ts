import type { FriendStatus } from '@mayday/shared';
import { prisma } from '../config/database.js';

// Friendships are stored once per pair with userAId < userBId (sorted), mirroring
// the Conversation convention, so the relationship is order-independent and the
// @@unique([userAId, userBId]) constraint catches duplicates regardless of who
// initiated. Always go through this helper when reading or writing a Friendship.
export function orderedPair(
  userOneId: string,
  userTwoId: string,
): { userAId: string; userBId: string } {
  const [userAId, userBId] = [userOneId, userTwoId].sort();
  return { userAId: userAId!, userBId: userBId! };
}

// All accepted friends of a user, as a flat list of the *other* user's ids.
// Used to scope FRIENDS-visibility posts.
export async function getFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId));
}

export async function areFriends(
  userOneId: string,
  userTwoId: string,
): Promise<boolean> {
  const pair = orderedPair(userOneId, userTwoId);
  const friendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: pair },
    select: { id: true },
  });
  return friendship !== null;
}

// Resolve how `viewerId` relates to `profileId`, for the profile friend button.
// `requestId` is the incoming request when REQUEST_RECEIVED (so the viewer can
// accept/decline) or the outgoing request when REQUEST_SENT (so they can cancel);
// null otherwise.
export async function getFriendStatus(
  viewerId: string,
  profileId: string,
): Promise<{ status: FriendStatus; requestId: string | null }> {
  if (viewerId === profileId) return { status: 'NONE', requestId: null };

  if (await areFriends(viewerId, profileId)) {
    return { status: 'FRIENDS', requestId: null };
  }

  // A pending request can exist in either direction; surface whichever applies.
  const [outgoing, incoming] = await Promise.all([
    prisma.friendRequest.findUnique({
      where: { senderId_recipientId: { senderId: viewerId, recipientId: profileId } },
      select: { id: true, status: true },
    }),
    prisma.friendRequest.findUnique({
      where: { senderId_recipientId: { senderId: profileId, recipientId: viewerId } },
      select: { id: true, status: true },
    }),
  ]);

  if (incoming?.status === 'PENDING') {
    return { status: 'REQUEST_RECEIVED', requestId: incoming.id };
  }
  if (outgoing?.status === 'PENDING') {
    return { status: 'REQUEST_SENT', requestId: outgoing.id };
  }
  return { status: 'NONE', requestId: null };
}
