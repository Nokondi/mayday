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
