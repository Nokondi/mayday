import { useQuery } from "@tanstack/react-query";
import { FormattedMessage } from "react-intl";
import { getUserFriends } from "../../api/friends.js";
import { UserCard } from "./UserCard.js";
import { LoadingSpinner } from "../common/LoadingSpinner.js";

// The friends section shown on a user's profile. Read-only here; the friend
// button (add/accept/remove) lives in the profile header.
export function FriendsList({ userId }: { userId: string }) {
  const { data: friends, isLoading } = useQuery({
    queryKey: ["userFriends", userId],
    queryFn: () => getUserFriends(userId),
    enabled: !!userId,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!friends) return null;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        <FormattedMessage
          id="profile.friends.heading"
          defaultMessage="Friends ({count})"
          values={{ count: friends.length }}
        />
      </h2>
      {friends.length === 0 ? (
        <p className="text-sm text-gray-600">
          <FormattedMessage
            id="profile.friends.empty"
            defaultMessage="No friends yet."
          />
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {friends.map((friend) => (
            <UserCard key={friend.id} user={friend} />
          ))}
        </div>
      )}
    </div>
  );
}
