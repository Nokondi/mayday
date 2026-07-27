import { Link } from "react-router";
import { FormattedMessage } from "react-intl";
import { Check, X, Building2, Users, UserPlus } from "lucide-react";
import type { InviteMessageMetadata } from "@mayday/shared";

interface InviteMessageCardProps {
  metadata: InviteMessageMetadata;
  // True when the current user is the invitee (the only one who can act).
  isRecipient: boolean;
  onAccept: () => void;
  onDecline: () => void;
  // Disables the buttons while an accept/decline request is in flight.
  isActing: boolean;
}

export function InviteMessageCard({
  metadata,
  isRecipient,
  onAccept,
  onDecline,
  isActing,
}: InviteMessageCardProps) {
  const isOrg = metadata.inviteKind === "ORGANIZATION";
  const isFriend = metadata.inviteKind === "FRIEND";
  const Icon = isOrg ? Building2 : isFriend ? UserPlus : Users;
  const to = isOrg
    ? `/organizations/${metadata.targetId}`
    : isFriend
      ? `/profile/${metadata.targetId}`
      : `/communities/${metadata.targetId}`;

  return (
    <div className="max-w-[85%] w-full sm:max-w-md bg-white rounded-2xl border border-mayday-300 p-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
        <Link
          to={to}
          className="font-semibold text-gray-900 hover:text-mayday-600 truncate"
        >
          {metadata.targetName}
        </Link>
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${
            isOrg
              ? "bg-gray-100 text-gray-600"
              : isFriend
                ? "bg-green-100 text-green-700"
                : "bg-blue-100 text-blue-600"
          }`}
        >
          {isOrg ? (
            <FormattedMessage
              id="invites.organizationBadge"
              defaultMessage="Organization"
            />
          ) : isFriend ? (
            <FormattedMessage
              id="invites.friendBadge"
              defaultMessage="Friend request"
            />
          ) : (
            <FormattedMessage
              id="invites.communityBadge"
              defaultMessage="Community"
            />
          )}
        </span>
      </div>

      <p className="text-sm text-gray-600 mt-1">
        {isOrg ? (
          <FormattedMessage
            id="messages.invite.organizationPrompt"
            defaultMessage="You've been invited to join this organization."
          />
        ) : isFriend ? (
          <FormattedMessage
            id="messages.invite.friendPrompt"
            defaultMessage="{name} wants to be your friend."
            values={{ name: metadata.targetName }}
          />
        ) : (
          <FormattedMessage
            id="messages.invite.communityPrompt"
            defaultMessage="You've been invited to join this community."
          />
        )}
      </p>

      {metadata.status === "PENDING" ? (
        isRecipient ? (
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onAccept}
              disabled={isActing}
              className="flex items-center gap-1 bg-mayday-700 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-mayday-800 disabled:opacity-50"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <FormattedMessage id="invites.acceptButton" defaultMessage="Accept" />
            </button>
            <button
              type="button"
              onClick={onDecline}
              disabled={isActing}
              className="flex items-center gap-1 border border-mayday-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <FormattedMessage id="invites.declineButton" defaultMessage="Decline" />
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500 mt-3">
            <FormattedMessage
              id="messages.invite.statusPending"
              defaultMessage="Invitation pending"
            />
          </p>
        )
      ) : (
        <p className="text-xs font-medium text-gray-500 mt-3">
          {metadata.status === "ACCEPTED" ? (
            isFriend ? (
              <FormattedMessage
                id="messages.invite.statusFriends"
                defaultMessage="Friends"
              />
            ) : (
              <FormattedMessage
                id="messages.invite.statusAccepted"
                defaultMessage="Joined"
              />
            )
          ) : metadata.status === "DECLINED" ? (
            <FormattedMessage
              id="messages.invite.statusDeclined"
              defaultMessage="Declined"
            />
          ) : (
            <FormattedMessage
              id="messages.invite.statusRevoked"
              defaultMessage="Invitation withdrawn"
            />
          )}
        </p>
      )}
    </div>
  );
}
