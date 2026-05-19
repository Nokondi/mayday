import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToastMutation } from "../hooks/useToastMutation.js";
import {
  Users,
  MapPin,
  CheckCircle2,
  Settings,
  LogOut,
  Trash2,
} from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  getOrganization,
  getOrganizationInvites,
  getOrganizationPosts,
  inviteToOrganization,
  removeMember,
  revokeInvite,
  deleteOrganization,
} from "../api/organizations.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { MembersSection } from "../components/common/MembersSection.js";
import { LinksList } from "../components/common/LinksList.js";
import { PostList } from "../components/posts/PostList.js";
import { useAuth } from "../context/AuthContext.js";

export function OrganizationDetailPage() {
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

  const { data: postsData } = useQuery({
    queryKey: ["organization-posts", id],
    queryFn: () => getOrganizationPosts(id!),
    enabled: !!id,
  });

  const canManage = org?.myRole === "OWNER" || org?.myRole === "ADMIN";

  const { data: orgInvites } = useQuery({
    queryKey: ["organization", id, "invites"],
    queryFn: () => getOrganizationInvites(id!),
    enabled: !!id && canManage,
  });

  const leaveMutation = useToastMutation({
    mutationFn: () => removeMember(id!, user!.id),
    successMessage: intl.formatMessage({
      id: "orgs.detailPage.leaveSuccessToast",
      defaultMessage: "Left organization",
    }),
    errorMessage: (e: any) =>
      e?.response?.data?.message ||
      intl.formatMessage({
        id: "groups.detailPage.leaveFailedFallback",
        defaultMessage: "Failed to leave",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["my-organizations"] });
      navigate("/organizations");
    },
  });

  const deleteMutation = useToastMutation({
    mutationFn: () => deleteOrganization(id!),
    successMessage: intl.formatMessage({
      id: "orgs.detailPage.deleteSuccessToast",
      defaultMessage: "Organization deleted",
    }),
    errorMessage: intl.formatMessage({
      id: "orgs.detailPage.deleteFailedToast",
      defaultMessage: "Failed to delete organization",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["my-organizations"] });
      navigate("/organizations");
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

  const isOwner = org.myRole === "OWNER";
  const isAdminOrOwner = isOwner || org.myRole === "ADMIN";
  const isMember = !!org.myRole;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          {org.avatarUrl && (
            <img
              src={org.avatarUrl}
              alt=""
              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            {org.description && (
              <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                {org.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <FormattedMessage
                  id="common.entityCard.memberCount"
                  defaultMessage="{count, plural, one {# member} other {# members}}"
                  values={{ count: org.memberCount }}
                />
              </span>
              {org.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {org.location}
                </span>
              )}
              {!!org.fulfilledCount && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <FormattedMessage
                    id="orgs.detailPage.fulfilledCount"
                    defaultMessage="{count, plural, one {# request} other {# requests}} fulfilled"
                    values={{ count: org.fulfilledCount }}
                  />
                </span>
              )}
              {org.myRole && (
                <span className="text-mayday-600 font-medium">
                  <FormattedMessage
                    id="common.entityCard.viewerRole"
                    defaultMessage="You: {role}"
                    values={{ role: org.myRole.toLowerCase() }}
                  />
                </span>
              )}
            </div>
            {org.links && org.links.length > 0 && (
              <LinksList links={org.links} className="mt-3" />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {isAdminOrOwner && (
            <Link
              to={`/organizations/${org.id}/manage`}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              <Settings className="w-4 h-4" />
              <FormattedMessage
                id="groups.detailPage.manageButton"
                defaultMessage="Manage"
              />
            </Link>
          )}
          {isMember && !isOwner && (
            <button
              onClick={() => {
                if (
                  confirm(
                    intl.formatMessage({
                      id: "orgs.detailPage.leaveConfirm",
                      defaultMessage: "Leave this organization?",
                    }),
                  )
                )
                  leaveMutation.mutate();
              }}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="w-4 h-4" />
              <FormattedMessage
                id="groups.detailPage.leaveButton"
                defaultMessage="Leave"
              />
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => {
                if (
                  confirm(
                    intl.formatMessage({
                      id: "orgs.detailPage.deleteConfirm",
                      defaultMessage:
                        "Delete this organization? This cannot be undone.",
                    }),
                  )
                )
                  deleteMutation.mutate();
              }}
              className="flex items-center gap-1 px-3 py-2 border border-red-300 rounded-lg text-sm text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              <FormattedMessage
                id="groups.detailPage.deleteButton"
                defaultMessage="Delete"
              />
            </button>
          )}
        </div>
      </div>
      <div className="mb-6">
        <MembersSection
          members={org.members}
          invite={
            isAdminOrOwner
              ? {
                  inviteEmail: (email) =>
                    inviteToOrganization(id!, { email }),
                  pending: orgInvites,
                  revoke: (inviteId) => revokeInvite(id!, inviteId),
                  onSettled: () => {
                    queryClient.invalidateQueries({
                      queryKey: ["organization", id],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["organization", id, "invites"],
                    });
                  },
                }
              : undefined
          }
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <FormattedMessage
            id="orgs.detailPage.postsHeading"
            defaultMessage="Posts"
          />
        </h2>
        {postsData ? <PostList posts={postsData.data} /> : <LoadingSpinner />}
      </div>
    </div>
  );
}
