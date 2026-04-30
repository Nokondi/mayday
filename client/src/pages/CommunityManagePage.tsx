import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Trash2,
  UserPlus,
  ArrowLeft,
  UserCheck,
  UserX,
  Users as UsersIcon,
} from "lucide-react";
import {
  inviteToCommunitySchema,
  updateCommunitySchema,
  type InviteToCommunityRequest,
  type UpdateCommunityRequest,
} from "@mayday/shared";
import {
  getCommunity,
  getCommunityInvites,
  inviteToCommunity,
  revokeCommunityInvite,
  removeCommunityMember,
  updateCommunityMemberRole,
  updateCommunity,
  uploadCommunityAvatar,
  getCommunityJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from "../api/communities.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { AvatarUploader } from "../components/common/AvatarUploader.js";
import { useAuth } from "../context/AuthContext.js";

export function CommunityManagePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: community, isLoading } = useQuery({
    queryKey: ["community", id],
    queryFn: () => getCommunity(id!),
    enabled: !!id,
  });

  const { data: invites } = useQuery({
    queryKey: ["community", id, "invites"],
    queryFn: () => getCommunityInvites(id!),
    enabled:
      !!id && (community?.myRole === "OWNER" || community?.myRole === "ADMIN"),
  });

  const { data: joinRequests } = useQuery({
    queryKey: ["community", id, "join-requests"],
    queryFn: () => getCommunityJoinRequests(id!),
    enabled:
      !!id && (community?.myRole === "OWNER" || community?.myRole === "ADMIN"),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveJoinRequest(id!, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id] });
      queryClient.invalidateQueries({
        queryKey: ["community", id, "join-requests"],
      });
      toast.success("Request approved");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => rejectJoinRequest(id!, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["community", id, "join-requests"],
      });
      toast.success("Request rejected");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Failed to reject"),
  });

  const inviteForm = useForm<InviteToCommunityRequest>({
    resolver: zodResolver(inviteToCommunitySchema),
  });

  const editForm = useForm<UpdateCommunityRequest>({
    resolver: zodResolver(updateCommunitySchema),
    values: community
      ? {
          name: community.name,
          description: community.description ?? undefined,
          location: community.location ?? undefined,
          avatarUrl: community.avatarUrl ?? undefined,
        }
      : undefined,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteToCommunityRequest) =>
      inviteToCommunity(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id, "invites"] });
      toast.success("Invite sent");
      inviteForm.reset();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Failed to send invite"),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeCommunityInvite(id!, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id, "invites"] });
      toast.success("Invite revoked");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeCommunityMember(id!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id] });
      toast.success("Member removed");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Failed to remove member"),
  });

  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: "ADMIN" | "MEMBER";
    }) => updateCommunityMemberRole(id!, userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id] });
      toast.success("Role updated");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Failed to update role"),
  });

  const editMutation = useMutation({
    mutationFn: (data: UpdateCommunityRequest) => updateCommunity(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast.success("Community updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!community)
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">Community not found.</div>
    );

  if (community.myRole !== "OWNER" && community.myRole !== "ADMIN") {
    navigate(`/communities/${community.id}`, { replace: true });
    return null;
  }

  const isOwner = community.myRole === "OWNER";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link
        to={`/communities/${community.id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {community.name}
      </Link>

      {/* Edit details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Community Details
        </h2>

        <div className="mb-4">
          <p className="block text-sm font-medium text-gray-700 mb-2">Avatar</p>
          <AvatarUploader
            currentUrl={community.avatarUrl}
            fallback={<UsersIcon className="w-8 h-8 text-gray-500" />}
            onUpload={async (file) => {
              await uploadCommunityAvatar(id!, file);
              queryClient.invalidateQueries({ queryKey: ["community", id] });
              queryClient.invalidateQueries({ queryKey: ["communities"] });
            }}
            shape="square"
          />
        </div>

        <form
          onSubmit={editForm.handleSubmit((data) => {
            const clean: UpdateCommunityRequest = {};
            if (data.name) clean.name = data.name;
            clean.description = data.description || undefined;
            clean.location = data.location || undefined;
            editMutation.mutate(clean);
          })}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="community-edit-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name
            </label>
            <input
              id="community-edit-name"
              {...editForm.register("name")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="community-edit-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="community-edit-description"
              {...editForm.register("description")}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="community-edit-location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Location
            </label>
            <input
              id="community-edit-location"
              {...editForm.register("location")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={editMutation.isPending}
            className="bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800 disabled:opacity-50"
          >
            Save changes
          </button>
        </form>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Invite a Member
        </h2>
        <form
          onSubmit={inviteForm.handleSubmit((data) =>
            inviteMutation.mutate(data),
          )}
          className="flex gap-2"
        >
          <input
            type="email"
            {...inviteForm.register("email")}
            placeholder="user@example.com"
            aria-label="Email address to invite"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="flex items-center gap-1 bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            Invite
          </button>
        </form>
        {inviteForm.formState.errors.email && (
          <p className="text-red-500 text-sm mt-1">
            {inviteForm.formState.errors.email.message}
          </p>
        )}

        {invites && invites.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Pending invites
            </h3>
            <ul className="divide-y divide-gray-100">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="py-2 flex items-center justify-between"
                >
                  <span className="text-sm text-gray-900">
                    {inv.invitedUser?.name ?? "Pending invite"}
                  </span>
                  <button
                    onClick={() => revokeMutation.mutate(inv.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Join Requests */}
      {joinRequests && joinRequests.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Join Requests
          </h2>
          <ul className="divide-y divide-gray-100">
            {joinRequests.map((jr) => (
              <li
                key={jr.id}
                className="py-3 flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/profile/${jr.userId}`}
                    className="text-gray-900 hover:text-mayday-600"
                  >
                    {jr.user?.name ?? "Unknown user"}
                  </Link>
                  {jr.message && (
                    <p className="text-sm text-gray-500 mt-1 truncate">
                      {jr.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveMutation.mutate(jr.id)}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(jr.id)}
                    disabled={rejectMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <UserX className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Members */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
        <ul className="divide-y divide-gray-100">
          {community.members.map((m) => {
            const isSelf = m.userId === user?.id;
            const canChangeRole = isOwner && !isSelf && m.role !== "OWNER";
            const canRemove =
              !isSelf &&
              m.role !== "OWNER" &&
              (isOwner ||
                (community.myRole === "ADMIN" && m.role === "MEMBER"));

            return (
              <li
                key={m.id}
                className="py-3 flex items-center justify-between gap-2"
              >
                <Link
                  to={`/profile/${m.user.id}`}
                  className="text-gray-900 hover:text-mayday-600 flex-1 min-w-0 truncate"
                >
                  {m.user.name}{" "}
                  {isSelf && (
                    <span className="text-xs text-gray-500">(you)</span>
                  )}
                </Link>
                <div className="flex items-center gap-2">
                  {canChangeRole ? (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        roleMutation.mutate({
                          userId: m.userId,
                          role: e.target.value as "ADMIN" | "MEMBER",
                        })
                      }
                      aria-label={`Role for ${m.user.name}`}
                      className="text-xs border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  ) : (
                    <span className="text-xs uppercase tracking-wider text-gray-500">
                      {m.role}
                    </span>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${m.user.name}?`))
                          removeMutation.mutate(m.userId);
                      }}
                      aria-label={`Remove ${m.user.name}`}
                      className="text-gray-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
