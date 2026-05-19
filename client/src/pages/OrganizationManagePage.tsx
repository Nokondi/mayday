import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToastMutation } from "../hooks/useToastMutation.js";
import { Trash2, ArrowLeft, Building2, Crown } from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  updateOrganizationSchema,
  type UpdateOrganizationRequest,
  type ProfileLink,
} from "@mayday/shared";
import {
  getOrganization,
  getOrganizationInvites,
  inviteToOrganization,
  revokeInvite,
  removeMember,
  updateMemberRole,
  updateOrganization,
  uploadOrganizationAvatar,
  transferOrganizationOwnership,
} from "../api/organizations.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { AvatarUploader } from "../components/common/AvatarUploader.js";
import { InviteEmailsField } from "../components/common/InviteEmailsField.js";
import { FormField } from "../components/common/FormField.js";
import { LinksEditor, cleanLinks } from "../components/common/LinksEditor.js";
import { TransferOwnershipDialog } from "../components/common/TransferOwnershipDialog.js";
import { useBatchInvite } from "../hooks/useBatchInvite.js";
import { useAuth } from "../context/AuthContext.js";

export function OrganizationManagePage() {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: org, isLoading } = useQuery({
    queryKey: ["organization", id],
    queryFn: () => getOrganization(id!),
    enabled: !!id,
  });

  const { data: invites } = useQuery({
    queryKey: ["organization", id, "invites"],
    queryFn: () => getOrganizationInvites(id!),
    enabled: !!id && (org?.myRole === "OWNER" || org?.myRole === "ADMIN"),
  });

  const inviteBatch = useBatchInvite({
    inviteEmail: (email) => inviteToOrganization(id!, { email }),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["organization", id, "invites"],
      }),
  });

  const editForm = useForm<UpdateOrganizationRequest>({
    resolver: zodResolver(updateOrganizationSchema),
    values: org
      ? {
          name: org.name,
          description: org.description ?? undefined,
          location: org.location ?? undefined,
        }
      : undefined,
  });

  const [links, setLinks] = useState<ProfileLink[]>([]);
  useEffect(() => {
    setLinks(org?.links ?? []);
  }, [org?.id, org?.links]);

  const [transferOpen, setTransferOpen] = useState(false);

  const transferMutation = useToastMutation({
    mutationFn: (newOwnerId: string) =>
      transferOrganizationOwnership(id!, { newOwnerId }),
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
      queryClient.invalidateQueries({ queryKey: ["organization", id] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const revokeMutation = useToastMutation({
    mutationFn: (inviteId: string) => revokeInvite(id!, inviteId),
    successMessage: intl.formatMessage({
      id: "groups.managePage.inviteRevokedToast",
      defaultMessage: "Invite revoked",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization", id, "invites"],
      });
    },
  });

  const removeMutation = useToastMutation({
    mutationFn: (userId: string) => removeMember(id!, userId),
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
      queryClient.invalidateQueries({ queryKey: ["organization", id] });
    },
  });

  const roleMutation = useToastMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: "ADMIN" | "MEMBER";
    }) => updateMemberRole(id!, userId, { role }),
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
      queryClient.invalidateQueries({ queryKey: ["organization", id] });
    },
  });

  const editMutation = useToastMutation({
    mutationFn: (data: UpdateOrganizationRequest) =>
      updateOrganization(id!, data),
    successMessage: intl.formatMessage({
      id: "orgs.managePage.updateSuccessToast",
      defaultMessage: "Organization updated",
    }),
    errorMessage: intl.formatMessage({
      id: "groups.managePage.updateFailedToast",
      defaultMessage: "Failed to update",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", id] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!org)
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <FormattedMessage
          id="orgs.detailPage.notFound"
          defaultMessage="Organization not found."
        />
      </div>
    );

  if (org.myRole !== "OWNER" && org.myRole !== "ADMIN") {
    navigate(`/organizations/${org.id}`, { replace: true });
    return null;
  }

  const isOwner = org.myRole === "OWNER";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link
        to={`/organizations/${org.id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <FormattedMessage
          id="groups.managePage.backToLink"
          defaultMessage="Back to {name}"
          values={{ name: org.name }}
        />
      </Link>

      {/* Edit org details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <FormattedMessage
            id="orgs.managePage.detailsHeading"
            defaultMessage="Organization Details"
          />
        </h2>

        <div className="mb-4">
          <p className="block text-sm font-medium text-gray-700 mb-2">
            <FormattedMessage
              id="common.fields.avatar"
              defaultMessage="Avatar"
            />{" "}
            <span className="text-gray-500 font-normal">
              <FormattedMessage
                id="common.formField.optionalSuffix"
                defaultMessage="(optional)"
              />
            </span>
          </p>
          <AvatarUploader
            currentUrl={org.avatarUrl}
            fallback={<Building2 className="w-8 h-8 text-gray-500" />}
            onUpload={async (file) => {
              await uploadOrganizationAvatar(id!, file);
              queryClient.invalidateQueries({ queryKey: ["organization", id] });
              queryClient.invalidateQueries({ queryKey: ["organizations"] });
            }}
            shape="square"
          />
        </div>

        <form
          onSubmit={editForm.handleSubmit((data) => {
            const clean: UpdateOrganizationRequest = {};
            if (data.name) clean.name = data.name;
            clean.description = data.description || undefined;
            clean.location = data.location || undefined;
            clean.links = cleanLinks(links) ?? [];
            editMutation.mutate(clean);
          })}
          className="space-y-4"
        >
          <FormField
            id="org-edit-name"
            label={intl.formatMessage({
              id: "common.fields.name",
              defaultMessage: "Name",
            })}
            error={editForm.formState.errors.name?.message}
            {...editForm.register("name")}
          />
          <FormField
            multiline
            id="org-edit-description"
            label={intl.formatMessage({
              id: "common.fields.description",
              defaultMessage: "Description",
            })}
            error={editForm.formState.errors.description?.message}
            rows={3}
            {...editForm.register("description")}
          />
          <FormField
            id="org-edit-location"
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
            idPrefix="org-edit-link"
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
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

      {/* Transfer ownership (OWNER only) */}
      {isOwner && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
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
              values={{ kind: "organization" }}
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <FormattedMessage
            id="groups.managePage.membersHeading"
            defaultMessage="Members"
          />
        </h2>
        <ul className="divide-y divide-gray-100">
          {org.members.map((m) => {
            const isSelf = m.userId === user?.id;
            const canChangeRole = isOwner && !isSelf && m.role !== "OWNER";
            // Owner can remove anyone except themselves; Admin can remove only MEMBERs
            const canRemove =
              !isSelf &&
              m.role !== "OWNER" &&
              (isOwner || (org.myRole === "ADMIN" && m.role === "MEMBER"));

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
                      className="text-xs border border-gray-300 rounded px-2 py-1"
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
                                id: "orgs.managePage.removeMemberConfirm",
                                defaultMessage:
                                  "Remove {name} from the organization?",
                              },
                              { name: m.user.name },
                            ),
                          )
                        ) {
                          removeMutation.mutate(m.userId);
                        }
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
        groupKind="organization"
        groupName={org.name}
        candidates={org.members
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
