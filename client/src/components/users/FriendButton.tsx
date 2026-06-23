import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FormattedMessage } from "react-intl";
import { UserPlus, UserCheck, UserX, Check, Clock } from "lucide-react";
import type { FriendStatus } from "@mayday/shared";
import { useToastMutation } from "../../hooks/useToastMutation.js";
import {
  sendFriendRequest,
  acceptFriendRequest,
  cancelFriendRequest,
  removeFriend,
} from "../../api/friends.js";

interface FriendButtonProps {
  // The profile being viewed.
  userId: string;
  // The viewer's relationship to that profile, from GET /users/:id.
  friendStatus: FriendStatus;
  // The relevant FriendRequest id for REQUEST_RECEIVED (accept) / REQUEST_SENT (cancel).
  friendRequestId?: string | null;
}

const baseClass =
  "flex items-center gap-1 px-4 py-2 rounded-lg text-sm disabled:opacity-50";
const primaryClass = `${baseClass} bg-mayday-700 text-white hover:bg-mayday-800`;
const outlineClass = `${baseClass} border border-mayday-300 text-gray-700 hover:bg-gray-50`;

export function FriendButton({
  userId,
  friendStatus,
  friendRequestId,
}: FriendButtonProps) {
  const queryClient = useQueryClient();
  // Two-click guard so a stray click on "Friends" doesn't silently unfriend.
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Refresh the viewed profile's friendStatus and its friend list after any change.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["user", userId] });
    queryClient.invalidateQueries({ queryKey: ["userFriends", userId] });
  };

  const sendMutation = useToastMutation({
    mutationFn: () => sendFriendRequest(userId),
    onSuccess: invalidate,
  });
  const acceptMutation = useToastMutation({
    mutationFn: () => acceptFriendRequest(friendRequestId!),
    onSuccess: invalidate,
  });
  const cancelMutation = useToastMutation({
    mutationFn: () => cancelFriendRequest(friendRequestId!),
    onSuccess: invalidate,
  });
  const removeMutation = useToastMutation({
    mutationFn: () => removeFriend(userId),
    onSuccess: () => {
      setConfirmRemove(false);
      invalidate();
    },
  });

  const pending =
    sendMutation.isPending ||
    acceptMutation.isPending ||
    cancelMutation.isPending ||
    removeMutation.isPending;

  switch (friendStatus) {
    case "REQUEST_RECEIVED":
      return (
        <button
          onClick={() => acceptMutation.mutate()}
          disabled={pending || !friendRequestId}
          className={primaryClass}
        >
          <Check className="w-4 h-4" aria-hidden="true" />
          <FormattedMessage
            id="profile.friend.acceptButton"
            defaultMessage="Accept request"
          />
        </button>
      );
    case "REQUEST_SENT":
      return (
        <button
          onClick={() => cancelMutation.mutate()}
          disabled={pending || !friendRequestId}
          className={outlineClass}
        >
          <Clock className="w-4 h-4" aria-hidden="true" />
          <FormattedMessage
            id="profile.friend.cancelButton"
            defaultMessage="Cancel request"
          />
        </button>
      );
    case "FRIENDS":
      return (
        <button
          onClick={() =>
            confirmRemove ? removeMutation.mutate() : setConfirmRemove(true)
          }
          onBlur={() => setConfirmRemove(false)}
          disabled={pending}
          className={outlineClass}
        >
          {confirmRemove ? (
            <>
              <UserX className="w-4 h-4" aria-hidden="true" />
              <FormattedMessage
                id="profile.friend.removeConfirm"
                defaultMessage="Remove friend?"
              />
            </>
          ) : (
            <>
              <UserCheck className="w-4 h-4" aria-hidden="true" />
              <FormattedMessage
                id="profile.friend.friendsLabel"
                defaultMessage="Friends"
              />
            </>
          )}
        </button>
      );
    default:
      return (
        <button
          onClick={() => sendMutation.mutate()}
          disabled={pending}
          className={primaryClass}
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          <FormattedMessage
            id="profile.friend.addButton"
            defaultMessage="Add friend"
          />
        </button>
      );
  }
}
