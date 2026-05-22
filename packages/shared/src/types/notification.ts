// Events that trigger user-facing notifications (email, push, etc.). Each
// variant carries the data needed to render the message for any channel.
export type NotificationEvent =
  | {
      type: 'NEW_MESSAGE';
      senderName: string;
      senderId: string;
      conversationId: string;
      content: string;
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
