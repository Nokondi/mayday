import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToastMutation } from "../hooks/useToastMutation.js";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  User as UserIcon,
  MapPin,
  Calendar,
  CheckCircle2,
  Edit2,
  Save,
  X,
  MessageSquare,
  Trash2,
  Flag,
  Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FormattedMessage, useIntl } from "react-intl";
import type { DeleteAccountRequest, ProfileLink } from "@mayday/shared";
import {
  getUser,
  updateProfile,
  getUserPosts,
  uploadUserAvatar,
  deleteProfile,
  createReport,
  getOwnedGroups,
} from "../api/users.js";
import { startConversation } from "../api/messages.js";
import { useAuth } from "../context/AuthContext.js";
import { PostList } from "../components/posts/PostList.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { AvatarUploader } from "../components/common/AvatarUploader.js";
import { SettingsModal } from "../components/common/SettingsModal.js";
import { LinksEditor, cleanLinks } from "../components/common/LinksEditor.js";
import { LinksList } from "../components/common/LinksList.js";

export function ProfilePage() {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser, refreshUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    location: "",
    skills: "",
  });
  const [editLinks, setEditLinks] = useState<ProfileLink[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [reportDetails, setReportDetails] = useState("");
  const reportDialogRef = useRef<HTMLDialogElement>(null);
  // Heir selections — `communityHeirs[id]` / `organizationHeirs[id]` is the picked userId,
  // or '' meaning "fall back to server auto-pick". Solo-owner groups have no entry.
  const [communityHeirs, setCommunityHeirs] = useState<Record<string, string>>({});
  const [organizationHeirs, setOrganizationHeirs] = useState<Record<string, string>>({});

  useEffect(() => {
    const dialog = reportDialogRef.current;
    if (!dialog) return;
    if (showReportConfirm && !dialog.open) dialog.showModal();
    else if (!showReportConfirm && dialog.open) dialog.close();
  }, [showReportConfirm]);

  useEffect(() => {
    const dialog = reportDialogRef.current;
    if (!dialog) return;
    const handleClose = () => setShowReportConfirm(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // Reset the details field whenever the dialog is closed, for any reason.
  useEffect(() => {
    if (!showReportConfirm) setReportDetails("");
  }, [showReportConfirm]);

  const isOwnProfile = authUser?.id === id;

  const messageMutation = useToastMutation({
    mutationFn: () => startConversation({ participantId: id! }),
    errorMessage: intl.formatMessage({
      id: "profile.messageFailedToast",
      defaultMessage: "Could not start a conversation",
    }),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/messages?conversation=${conversation.id}`);
    },
  });

  const reportMutation = useToastMutation({
    mutationFn: () =>
      createReport({
        reason: "Inappropriate conduct",
        reportedUserId: id!,
        details: reportDetails.trim() || undefined,
      }),
    successMessage: intl.formatMessage({
      id: "report.successToast",
      defaultMessage: "Report submitted",
    }),
    errorMessage: intl.formatMessage({
      id: "report.failedToast",
      defaultMessage: "Failed to submit report",
    }),
    onSuccess: () => setShowReportConfirm(false),
    onError: () => setShowReportConfirm(false),
  });

  // Fetched only once the user opens the confirm step, so listing owned groups
  // isn't a side-effect of viewing your own profile.
  const ownedGroupsEnabled = isOwnProfile && confirmingDelete;
  const { data: ownedGroups, isLoading: ownedGroupsLoading } = useQuery({
    queryKey: ["users", "me", "owned-groups"],
    queryFn: getOwnedGroups,
    enabled: ownedGroupsEnabled,
  });

  // Seed heir selects with the server's auto-pick suggestion the first time
  // owned-groups data arrives, so the dropdown isn't empty.
  useEffect(() => {
    if (!ownedGroups) return;
    setCommunityHeirs((prev) => {
      const next = { ...prev };
      for (const g of ownedGroups.communities) {
        if (g.candidates.length > 0 && next[g.id] === undefined) {
          next[g.id] = g.defaultHeirUserId ?? "";
        }
      }
      return next;
    });
    setOrganizationHeirs((prev) => {
      const next = { ...prev };
      for (const g of ownedGroups.organizations) {
        if (g.candidates.length > 0 && next[g.id] === undefined) {
          next[g.id] = g.defaultHeirUserId ?? "";
        }
      }
      return next;
    });
  }, [ownedGroups]);

  const deleteRequestBody = useMemo<DeleteAccountRequest>(() => {
    const body: DeleteAccountRequest = {};
    const cm = Object.fromEntries(
      Object.entries(communityHeirs).filter(([, v]) => v),
    );
    const om = Object.fromEntries(
      Object.entries(organizationHeirs).filter(([, v]) => v),
    );
    if (Object.keys(cm).length) body.communityHeirs = cm;
    if (Object.keys(om).length) body.organizationHeirs = om;
    return body;
  }, [communityHeirs, organizationHeirs]);

  const deleteMutation = useToastMutation({
    mutationFn: () => deleteProfile(id!, deleteRequestBody),
    successMessage: intl.formatMessage({
      id: "profile.deleteAccount.successToast",
      defaultMessage: "Your account has been deleted.",
    }),
    errorMessage: (e: any) =>
      e?.response?.data?.message ||
      intl.formatMessage({
        id: "profile.deleteAccount.failedFallback",
        defaultMessage: "Failed to delete account",
      }),
    onSuccess: async () => {
      queryClient.clear();
      // Clear client-side session state; the server has already cleared the refresh cookie.
      await logout().catch(() => {});
      navigate("/");
    },
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => getUser(id!),
    enabled: !!id,
  });

  const { data: postsData } = useQuery({
    queryKey: ["userPosts", id],
    queryFn: () => getUserPosts(id!),
    enabled: !!id,
  });

  const updateMutation = useToastMutation({
    mutationFn: (data: any) => updateProfile(id!, data),
    successMessage: intl.formatMessage({
      id: "profile.updateSuccessToast",
      defaultMessage: "Profile updated",
    }),
    errorMessage: intl.formatMessage({
      id: "profile.updateFailedToast",
      defaultMessage: "Failed to update profile",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      setEditing(false);
    },
  });

  const startEditing = () => {
    if (!profile) return;
    setEditForm({
      name: profile.name,
      bio: profile.bio || "",
      location: profile.location || "",
      skills: profile.skills.join(", "),
    });
    setEditLinks(profile.links ?? []);
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      name: editForm.name,
      bio: editForm.bio || undefined,
      location: editForm.location || undefined,
      skills: editForm.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      links: cleanLinks(editLinks) ?? [],
    });
  };

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!profile)
    return (
      <div className="text-center py-20 text-gray-500">
        <FormattedMessage
          id="profile.notFound"
          defaultMessage="User not found"
        />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="relative bg-white rounded-lg border border-gray-200 p-6 mb-8">
        {!isOwnProfile && (
          <button
            type="button"
            onClick={() => setShowReportConfirm(true)}
            aria-label={intl.formatMessage({
              id: "profile.reportUserAction",
              defaultMessage: "Report user",
            })}
            title={intl.formatMessage({
              id: "profile.reportUserAction",
              defaultMessage: "Report user",
            })}
            className="absolute top-3 right-3 p-1.5 text-red-600 hover:bg-red-50 rounded"
          >
            <Flag className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {isOwnProfile ? (
              <AvatarUploader
                currentUrl={profile.avatarUrl}
                fallback={<UserIcon className="w-16 h-16 text-mayday-600" />}
                onUpload={async (file) => {
                  await uploadUserAvatar(id!, file);
                  queryClient.invalidateQueries({ queryKey: ["user", id] });
                  await refreshUser();
                }}
                size={128}
              />
            ) : profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="w-32 h-32 rounded-full object-cover"
              />
            ) : (
              <div className="w-32 h-32 bg-mayday-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-16 h-16 text-mayday-600" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full text-xl font-bold border border-gray-300 rounded px-2 py-1"
                />
              ) : (
                <h1 className="text-xl font-bold text-gray-900">
                  {profile.name}
                </h1>
              )}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {editing ? (
                      <input
                        value={editForm.location}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            location: e.target.value,
                          }))
                        }
                        className="border border-gray-300 rounded px-2 py-0.5 text-sm"
                      />
                    ) : (
                      profile.location
                    )}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <FormattedMessage
                    id="profile.joinedRelative"
                    defaultMessage="Joined {time}"
                    values={{
                      time: formatDistanceToNow(new Date(profile.createdAt), {
                        addSuffix: true,
                      }),
                    }}
                  />
                </span>
                {!!profile.fulfilledCount && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <FormattedMessage
                      id="orgs.detailPage.fulfilledCount"
                      defaultMessage="{count, plural, one {# request} other {# requests}} fulfilled"
                      values={{ count: profile.fulfilledCount }}
                    />
                  </span>
                )}
              </div>
            </div>
          </div>
          {isOwnProfile && !editing && (
            <div className="flex flex-wrap flex-col gap-y-2 gap-x-3 sm:flex-row">
              <button
                onClick={startEditing}
                className="flex items-center gap-0 sm:gap-1 text-gray-600 hover:text-gray-700"
              >
                <Edit2 className="w-4 h-4 sm:mr-0" />
                <span className="hidden sm:inline">
                  {" "}
                  <FormattedMessage
                    id="profile.editButton"
                    defaultMessage="Edit"
                  />
                </span>
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-0 sm:gap-1 text-gray-600 hover:text-gray-700"
              >
                <Settings className="w-4 h-4 sm:mr-0" />
                <span className="hidden sm:inline">
                  {" "}
                  <FormattedMessage
                    id="common.settingsModal.title"
                    defaultMessage="Settings"
                  />
                </span>
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="profile-bio"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <FormattedMessage
                  id="profile.bioLabel"
                  defaultMessage="Bio"
                />
              </label>
              <textarea
                id="profile-bio"
                value={editForm.bio}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, bio: e.target.value }))
                }
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label
                htmlFor="profile-skills"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <FormattedMessage
                  id="profile.skillsLabel"
                  defaultMessage="Skills (comma-separated)"
                />
              </label>
              <input
                id="profile-skills"
                value={editForm.skills}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, skills: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <LinksEditor
              value={editLinks}
              onChange={setEditLinks}
              idPrefix="profile-link"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1 text-gray-600 hover:text-gray-700"
              >
                <X className="w-4 h-4" />{" "}
                <FormattedMessage
                  id="common.actions.cancel"
                  defaultMessage="Cancel"
                />
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 text-green-600 hover:text-green-700"
              >
                <Save className="w-4 h-4" />{" "}
                <FormattedMessage
                  id="profile.saveButton"
                  defaultMessage="Save"
                />
              </button>
            </div>
          </div>
        ) : (
          <>
            {profile.bio && <p className="mt-4 text-gray-700">{profile.bio}</p>}
            {profile.skills.length > 0 && (
              <ul
                aria-label={intl.formatMessage({
                  id: "profile.skillsListAriaLabel",
                  defaultMessage: "Skills",
                })}
                className="mt-4 flex flex-wrap gap-2"
              >
                {profile.skills.map((skill) => (
                  <li
                    key={skill}
                    className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            )}
            {profile.links && profile.links.length > 0 && (
              <LinksList links={profile.links} className="mt-4" />
            )}
          </>
        )}

        {!isOwnProfile && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => messageMutation.mutate()}
              disabled={messageMutation.isPending}
              className="flex items-center gap-1 bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800 disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              {messageMutation.isPending ? (
                <FormattedMessage
                  id="profile.messageButtonStarting"
                  defaultMessage="Starting…"
                />
              ) : (
                <FormattedMessage
                  id="profile.messageButton"
                  defaultMessage="Message"
                />
              )}
            </button>
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-4">
        <FormattedMessage
          id="orgs.detailPage.postsHeading"
          defaultMessage="Posts"
        />
      </h2>
      {postsData ? <PostList posts={postsData.data} /> : <LoadingSpinner />}

      {isOwnProfile && (
        <div className="mt-12 border border-red-200 bg-red-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            <FormattedMessage
              id="profile.deleteAccount.dangerZoneHeading"
              defaultMessage="Danger zone"
            />
          </h2>
          <p className="text-sm text-red-700 mb-4">
            <FormattedMessage
              id="profile.deleteAccount.intro"
              defaultMessage="Deleting your account removes your profile, posts, messages, and reports. Communities and organizations you own are transferred to the member you choose below, or deleted if you're the only member."
            />
          </p>
          {confirmingDelete ? (
            <div className="space-y-4">
              {ownedGroupsLoading && (
                <p className="text-sm text-red-800">
                  <FormattedMessage
                    id="profile.deleteAccount.loadingGroups"
                    defaultMessage="Loading owned groups…"
                  />
                </p>
              )}
              {ownedGroups &&
                (ownedGroups.communities.length > 0 ||
                  ownedGroups.organizations.length > 0) && (
                  <div className="bg-white border border-red-200 rounded-lg p-4 space-y-4">
                    <p className="text-sm font-medium text-gray-900">
                      <FormattedMessage
                        id="profile.deleteAccount.chooseHeirsLabel"
                        defaultMessage="Choose who inherits each group you own:"
                      />
                    </p>
                    {[
                      {
                        kind: "community" as const,
                        groups: ownedGroups.communities,
                        state: communityHeirs,
                        setState: setCommunityHeirs,
                      },
                      {
                        kind: "organization" as const,
                        groups: ownedGroups.organizations,
                        state: organizationHeirs,
                        setState: setOrganizationHeirs,
                      },
                    ].map(({ kind, groups, state, setState }) =>
                      groups.map((g) => {
                        const selectId = `heir-${kind}-${g.id}`;
                        if (g.candidates.length === 0) {
                          return (
                            <div
                              key={`${kind}-${g.id}`}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="text-sm text-gray-900 truncate">
                                {g.name}
                              </span>
                              <span className="text-xs text-gray-500 italic">
                                <FormattedMessage
                                  id="profile.deleteAccount.noOtherMembers"
                                  defaultMessage="no other members — will be deleted"
                                />
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={`${kind}-${g.id}`}
                            className="flex items-center justify-between gap-3"
                          >
                            <label
                              htmlFor={selectId}
                              className="text-sm text-gray-900 truncate flex-1"
                            >
                              {g.name}
                            </label>
                            <select
                              id={selectId}
                              value={state[g.id] ?? ""}
                              onChange={(e) =>
                                setState((prev) => ({
                                  ...prev,
                                  [g.id]: e.target.value,
                                }))
                              }
                              disabled={deleteMutation.isPending}
                              className="text-sm border border-gray-300 rounded px-2 py-1 max-w-[60%]"
                            >
                              {g.candidates.map((c) => (
                                <option key={c.userId} value={c.userId}>
                                  {intl.formatMessage(
                                    {
                                      id: "profile.deleteAccount.heirOptionLabel",
                                      defaultMessage: "{name} ({role})",
                                    },
                                    {
                                      name: c.name,
                                      role: c.role.toLowerCase(),
                                    },
                                  )}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }),
                    )}
                  </div>
                )}
              <p className="text-sm font-medium text-red-800">
                <FormattedMessage
                  id="profile.deleteAccount.areYouSure"
                  defaultMessage="This cannot be undone. Are you sure?"
                />
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending || ownedGroupsLoading}
                  className="flex items-center gap-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  {deleteMutation.isPending ? (
                    <FormattedMessage
                      id="profile.deleteAccount.deletingButton"
                      defaultMessage="Deleting…"
                    />
                  ) : (
                    <FormattedMessage
                      id="profile.deleteAccount.confirmButton"
                      defaultMessage="Yes, delete my account"
                    />
                  )}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <FormattedMessage
                    id="common.actions.cancel"
                    defaultMessage="Cancel"
                  />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1 border border-red-300 bg-white text-red-700 px-4 py-2 rounded-lg hover:bg-red-100"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <FormattedMessage
                id="profile.deleteAccount.openButton"
                defaultMessage="Delete my account"
              />
            </button>
          )}
        </div>
      )}

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <dialog
        ref={reportDialogRef}
        aria-labelledby="report-user-confirm-title"
        className="rounded-lg p-0 backdrop:bg-black/50 max-w-md w-full"
      >
        <div className="p-6">
          <h2
            id="report-user-confirm-title"
            className="text-lg font-semibold text-gray-900 flex items-center gap-2"
          >
            <Flag className="w-5 h-5 text-red-600" aria-hidden="true" />
            <FormattedMessage
              id="profile.reportDialog.title"
              defaultMessage="Report this user?"
            />
          </h2>
          <p className="mt-3 text-sm text-gray-700">
            <FormattedMessage
              id="profile.reportDialog.body"
              defaultMessage="The admin team will review {name}'s profile for inappropriate conduct. You can't undo a report, but you can file a new one later if needed."
              values={{ name: profile.name }}
            />
          </p>
          <div className="mt-4">
            <label
              htmlFor="report-user-details"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              <FormattedMessage
                id="report.detailsLabel"
                defaultMessage="Additional details"
              />{" "}
              <span className="text-gray-500 font-normal">
                <FormattedMessage
                  id="common.formField.optionalSuffix"
                  defaultMessage="(optional)"
                />
              </span>
            </label>
            <textarea
              id="report-user-details"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={intl.formatMessage({
                id: "profile.reportDialog.detailsPlaceholder",
                defaultMessage:
                  "What happened? Any context that will help the admin team is welcome.",
              })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowReportConfirm(false)}
              disabled={reportMutation.isPending}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FormattedMessage
                id="common.actions.cancel"
                defaultMessage="Cancel"
              />
            </button>
            <button
              type="button"
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Flag className="w-4 h-4" aria-hidden="true" />
              {reportMutation.isPending ? (
                <FormattedMessage
                  id="report.submittingButton"
                  defaultMessage="Submitting…"
                />
              ) : (
                <FormattedMessage
                  id="profile.reportUserAction"
                  defaultMessage="Report user"
                />
              )}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
