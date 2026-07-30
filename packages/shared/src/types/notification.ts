// User-facing notification groupings for per-category channel muting. Admin
// operational notifications (bug/user reports) have no category and always
// send. Mirrors the Prisma NotificationCategory enum. Order matters: the
// settings matrix renders rows in this order, with the post audiences last so
// the post-specific controls (urgency, communities, frequency) follow them.
export const NOTIFICATION_CATEGORIES = [
  'INVITES',
  'JOIN_REQUESTS',
  'MESSAGES',
  'COMMENTS',
  'FRIEND_REQUESTS',
  'ANNOUNCEMENTS',
  'FRIEND_POSTS',
  'COMMUNITY_POSTS',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

// Events that trigger user-facing notifications (email, push, etc.). Each
// variant carries the data needed to render the message for any channel.
export type NotificationEvent =
  | {
      type: 'NEW_MESSAGE';
      senderName: string;
      senderId: string;
      conversationId: string;
      content: string;
      // E2EE: when true, the notification channels must not include any
      // message preview text. The push notification body is suppressed and
      // the email omits the blockquote — sender name is still visible
      // since it's already metadata the server stores in plaintext.
      isEncrypted?: boolean;
    }
  | {
      type: 'COMMUNITY_JOIN_REQUEST';
      communityId: string;
      communityName: string;
      requesterName: string;
      message: string | null;
    }
  | {
      type: 'COMMUNITY_JOIN_APPROVED';
      communityId: string;
      communityName: string;
    }
  | {
      type: 'COMMUNITY_INVITE';
      communityId: string;
      communityName: string;
      inviterName: string;
    }
  | {
      type: 'ORGANIZATION_INVITE';
      organizationId: string;
      organizationName: string;
      inviterName: string;
    }
  | {
      type: 'NEW_COMMENT';
      postId: string;
      postTitle: string;
      commenterId: string;
      commenterName: string;
    }
  | {
      type: 'FRIEND_REQUEST';
      senderId: string;
      senderName: string;
    }
  | {
      type: 'FRIEND_REQUEST_ACCEPTED';
      // The user who accepted the request (the original recipient).
      accepterId: string;
      accepterName: string;
    }
  | {
      type: 'NEW_POST';
      postId: string;
      postTitle: string;
      authorId: string;
      authorName: string;
      // Why this recipient is being notified: a friend's post, or a new post
      // in one of their communities. Community notifications carry the
      // community's name for the message copy.
      audience: 'friend' | 'community';
      communityId?: string;
      communityName?: string;
    }
  | {
      type: 'POST_DIGEST';
      // Total number of new posts in the digest window.
      count: number;
      // The posts to render in the digest email, newest first (may be capped
      // by the sender; `count` is always the full total).
      posts: Array<{
        id: string;
        title: string;
        authorName: string;
        // Set when the post reached the recipient via a community; null for
        // friends' posts.
        communityName: string | null;
      }>;
    }
  | {
      type: 'ANNOUNCEMENT';
      message: string;
    }
  | {
      type: 'BUG_REPORT_SUBMITTED';
      reportId: string;
      reporterName: string;
      title: string;
    }
  | {
      type: 'USER_REPORT_SUBMITTED';
      reportId: string;
      reporterName: string;
      reason: string;
      targetKind: 'user' | 'content';
    };

// Wire format for the payload sent to a browser PushSubscription. The service
// worker reads these fields directly when calling showNotification().
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  icon?: string;
}
