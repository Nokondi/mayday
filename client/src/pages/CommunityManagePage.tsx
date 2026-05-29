import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToastMutation } from "../hooks/useToastMutation.js";
import {
  Trash2,
  ArrowLeft,
  UserCheck,
  UserX,
  Users as UsersIcon,
  Crown,
} from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  updateCommunitySchema,
  type UpdateCommunityRequest,
  type ProfileLink,
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
  transferCommunityOwnership,
} from "../api/communities.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { AvatarUploader } from "../components/common/AvatarUploader.js";
import { InviteEmailsField } from "../components/common/InviteEmailsField.js";
import { FormField } from "../components/common/FormField.js";
import { LinksEditor, cleanLinks } from "../components/common/LinksEditor.js";
import { TransferOwnershipDialog } from "../components/common/TransferOwnershipDialog.js";
import { useBatchInvite } from "../hooks/useBatchInvite.js";
import { useAuth } from "../context/AuthContext.js";

export function CommunityManagePage() {
  const intl = useIntl();
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

  const approveMutation = useToastMutation({
    mutationFn: (requestId: string) => approveJoinRequest(id!, requestId),
    successMessage: intl.formatMessage({
      id: "communities.managePage.requestApprovedToast",
      defaultMessage: "Request approved",
    }),
    errorMessage: (e: any) =>
      e?.response?.data?.message ||
      intl.formatMessage({
        id: "communities.managePage.approveFailedFallback",
        defaultMessage: "Failed to approve",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id] });
      queryClient.invalidateQueries({
        queryKey: ["community", id, "join-requests"],
      });
    },
  });

  const rejectMutation = useToastMutation({
    mutationFn: (requestId: string) => rejectJoinRequest(id!, requestId),
    successMessage: intl.formatMessage({
      id: "communities.managePage.requestRejectedToast",
      defaultMessage: "Request rejected",
    }),
    errorMessage: (e: any) =>
      e?.response?.data?.message ||
      intl.formatMessage({
        id: "communities.managePage.rejectFailedFallback",
        defaultMessage: "Failed to reject",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["community", id, "join-requests"],
      });
    },
  });

  const inviteBatch = useBatchInvite({
    inviteEmail: (email) => inviteToCommunity(id!, { email }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["community", id, "invites"] }),
  });

  const editForm = useForm<UpdateCommunityRequest>({
    resolver: zodResolver(updateCommunitySchema),
    values: community
      ? {
          name: community.name,
          description: community.description ?? undefined,
          location: community.location ?? undefined,
        }
      : undefined,
  });

  const [links, setLinks] = useState<ProfileLink[]>([]);
  useEffect(() => {
    setLinks(community?.links ?? []);
  }, [community?.id, community?.links]);

  const [transferOpen, setTransferOpen] = useState(false);

  const transferMutation = useToastMutation({
    mutationFn: (newOwnerId: string) =>
      transferCommunityOwnership(id!, { newOwnerId }),
    successMessage: intl.formatMessage({
      id: "groups.transferOwnership.successToast",
      defaultMessage: "Ownership transferred",
    }),
    errorMessage: (e: any) =>
      e?.response?.data?.message ||
      intl.formatMessage({
        id: "groups.transferOwnership.failureToast",
        defaultMessage: "Failed to transfer ownership",
      }),
    onSuccess: () => {
      setTransferOpen(false);
      queryClient.invalidateQueries({ queryKey: ["community", id] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
  });

  const revokeMutation = useToastMutation({
    mutationFn: (inviteId: string) => revokeCommunityInvite(id!, inviteId),
    successMessage: intl.formatMessage({
      id: "groups.managePage.inviteRevokedToast",
      defaultMessage: "Invite revoked",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id, "invites"] });
    },
  });

  const removeMutation = useToastMutation({
    mutationFn: (userId: string) => removeCommunityMember(id!, userId),
    successMessage: intl.formatMessage({
      id: "groups.managePage.memberRemovedToast",
      defaultMessage: "Member removed",
    }),
    errorMessage: (e: any) =>
      e?.response?.data?.message ||
      intl.formatMessage({
        id: "groups.managePage.removeMemberFailedFallback",
        defaultMessage: "Failed to remove member",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id] });
    },
  });

  const roleMutation = useToastMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: "ADMIN" | "MEMBER";
    }) => updateCommunityMemberRole(id!, userId, { role }),
    successMessage: intl.formatMessage({
      id: "groups.managePage.roleUpdatedToast",
      defaultMessage: "Role updated",
    }),
    errorMessage: (e: any) =>
      e?.response?.data?.message ||
      intl.formatMessage({
        id: "groups.managePage.updateRoleFailedFallback",
        defaultMessage: "Failed to update role",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id] });
    },
  });

  const editMutation = useToastMutation({
    mutationFn: (data: UpdateCommunityRequest) => updateCommunity(id!, data),
    successMessage: intl.formatMessage({
      id: "communities.managePage.updateSuccessToast",
      defaultMessage: "Community updated",
    }),
    errorMessage: intl.formatMessage({
      id: "groups.managePage.updateFailedToast",
      defaultMessage: "Failed to update",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community", id] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!community)
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <FormattedMessage
          id="communities.detailPage.notFound"
          defaultMessage="Community not found."
        />
      </div>
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
        <FormattedMessage
          id="groups.managePage.backToLink"
          defaultMessage="Back to {name}"
          values={{ name: community.name }}
        />
      </Link>

      {/* Edit details */}
      <div className="bg-white rounded-lg border border-mayday-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <FormattedMessage
            id="communities.managePage.detailsHeading"
            defaultMessage="Community Details"
          />
        </h2>

        <div className="mb-4">
          <p className="block text-sm font-medium text-gray-700 mb-2">
            <FormattedMessage
              id="common.fields.avatar"
              defaultMessage="Avatar"
            />
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- layout whitespace between label and (optional) suffix */}
            {" "}
            <span className="text-gray-500 font-normal">
              <FormattedMessage
                id="common.formField.optionalSuffix"
                defaultMessage="(optional)"
              />
            </span>
          </p>
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
            clean.links = cleanLinks(links) ?? [];
            editMutation.mutate(clean);
          })}
          className="space-y-4"
        >
          <FormField
            id="community-edit-name"
            label={intl.formatMessage({
              id: "common.fields.name",
              defaultMessage: "Name",
            })}
            error={editForm.formState.errors.name?.message}
            {...editForm.register("name")}
          />
          <FormField
            multiline
            id="community-edit-description"
            label={intl.formatMessage({
              id: "common.fields.description",
              defaultMessage: "Description",
            })}
            error={editForm.formState.errors.description?.message}
            rows={3}
            {...editForm.register("description")}
          />
          <FormField
            id="community-edit-location"
            label={intl.formatMessage({
              id: "common.fields.location",
              defaultMessage: "Location",
            })}
            error={editForm.formState.errors.location?.message}
            {...editForm.register("location")}
            optional
          />
          <LinksEditor
            value={links}
            onChange={setLinks}
            idPrefix="community-edit-link"
          />
          <button
            type="submit"
            disabled={editMutation.isPending}
            className="bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800 disabled:opacity-50"
          >
            <FormattedMessage
              id="groups.managePage.saveChangesButton"
              defaultMessage="Save changes"
            />
          </button>
        </form>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-lg border border-mayday-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <FormattedMessage
            id="groups.managePage.inviteMembersHeading"
            defaultMessage="Invite Members"
          />
        </h2>
        <InviteEmailsField
          emails={inviteBatch.emails}
          onEmailsChange={inviteBatch.setEmails}
          onSubmit={inviteBatch.submit}
          isSubmitting={inviteBatch.isSubmitting}
          legend={null}
        />

        {invites && invites.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              <FormattedMessage
                id="groups.managePage.pendingInvitesHeading"
                defaultMessage="Pending invites"
              />
            </h3>
            <ul className="divide-y divide-gray-100">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="py-2 flex items-center justify-between"
                >
                  <span className="text-sm text-gray-900">
                    {inv.invitedUser?.name ??
                      intl.formatMessage({
                        id: "groups.managePage.pendingInviteFallback",
                        defaultMessage: "Pending invite",
                      })}
                  </span>
                  <button
                    onClick={() => revokeMutation.mutate(inv.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    <FormattedMessage
                      id="groups.managePage.revokeButton"
                      defaultMessage="Revoke"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Join Requests */}
      {joinRequests && joinRequests.length > 0 && (
        <div className="bg-white rounded-lg border border-mayday-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            <FormattedMessage
              id="communities.managePage.joinRequestsHeading"
              defaultMessage="Join Requests"
            />
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
                    {jr.user?.name ??
                      intl.formatMessage({
                        id: "communities.managePage.unknownUserFallback",
                        defaultMessage: "Unknown user",
                      })}
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
                    <FormattedMessage
                      id="communities.managePage.approveButton"
                      defaultMessage="Approve"
                    />
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(jr.id)}
                    disabled={rejectMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 border border-mayday-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <UserX className="w-4 h-4" />
                    <FormattedMessage
                      id="communities.managePage.rejectButton"
                      defaultMessage="Reject"
                    />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transfer ownership (OWNER only) */}
      {isOwner && (
        <div className="bg-white rounded-lg border border-mayday-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            <FormattedMessage
              id="groups.transferOwnership.title"
              defaultMessage="Transfer ownership"
            />
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            <FormattedMessage
              id="groups.transferOwnership.sectionBody"
              defaultMessage="Hand this {kind, select, community {community} organization {organization} other {group}} over to another member. You'll be demoted to Admin and the new owner will take over."
              values={{ kind: "community" }}
            />
          </p>
          <button
            type="button"
            onClick={() => setTransferOpen(true)}
            className="flex items-center gap-1 border border-amber-300 bg-white text-amber-800 px-4 py-2 rounded-lg hover:bg-amber-50"
          >
            <Crown className="w-4 h-4" aria-hidden="true" />
            <FormattedMessage
              id="groups.transferOwnership.title"
              defaultMessage="Transfer ownership"
            />
          </button>
        </div>
      )}

      {/* Members */}
      <div className="bg-white rounded-lg border border-mayday-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <FormattedMessage
            id="groups.managePage.membersHeading"
            defaultMessage="Members"
          />
        </h2>
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
                  {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- layout whitespace between member name and (you) marker */}
                  {m.user.name}{" "}
                  {isSelf && (
                    <span className="text-xs text-gray-500">
                      <FormattedMessage
                        id="groups.managePage.youMarker"
                        defaultMessage="(you)"
                      />
                    </span>
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
                      aria-label={intl.formatMessage(
                        {
                          id: "groups.managePage.roleSelectAria",
                          defaultMessage: "Role for {name}",
                        },
                        { name: m.user.name },
                      )}
                      className="text-xs border border-mayday-300 rounded px-2 py-1"
                    >
                      <option value="MEMBER">
                        {intl.formatMessage({
                          id: "groups.roles.member",
                          defaultMessage: "Member",
                        })}
                      </option>
                      <option value="ADMIN">
                        {intl.formatMessage({
                          id: "groups.roles.admin",
                          defaultMessage: "Admin",
                        })}
                      </option>
                    </select>
                  ) : (
                    <span className="text-xs uppercase tracking-wider text-gray-500">
                      {m.role}
                    </span>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            intl.formatMessage(
                              {
                                id: "communities.managePage.removeMemberConfirm",
                                defaultMessage: "Remove {name}?",
                              },
                              { name: m.user.name },
                            ),
                          )
                        )
                          removeMutation.mutate(m.userId);
                      }}
                      aria-label={intl.formatMessage(
                        {
                          id: "groups.managePage.removeMemberAria",
                          defaultMessage: "Remove {name}",
                        },
                        { name: m.user.name },
                      )}
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

      <TransferOwnershipDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        groupKind="community"
        groupName={community.name}
        candidates={community.members
          .filter((m) => m.userId !== user?.id && m.role !== "OWNER")
          .map((m) => ({
            userId: m.userId,
            name: m.user.name,
            role: m.role as "ADMIN" | "MEMBER",
          }))}
        onTransfer={(newOwnerId) =>
          transferMutation.mutateAsync(newOwnerId).then(() => undefined)
        }
        isPending={transferMutation.isPending}
      />
    </div>
  );
}
