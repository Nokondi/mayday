import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import { toast } from "sonner";
import {
  getUser,
  updateProfile,
  getUserPosts,
  uploadUserAvatar,
  deleteProfile,
  createReport,
} from "../api/users.js";
import { startConversation } from "../api/messages.js";
import { useAuth } from "../context/AuthContext.js";
import { PostList } from "../components/posts/PostList.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { AvatarUploader } from "../components/common/AvatarUploader.js";
import { SettingsModal } from "../components/common/SettingsModal.js";

export function ProfilePage() {
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [reportDetails, setReportDetails] = useState("");
  const reportDialogRef = useRef<HTMLDialogElement>(null);

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

  const messageMutation = useMutation({
    mutationFn: () => startConversation({ participantId: id! }),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/messages?conversation=${conversation.id}`);
    },
    onError: () => toast.error("Could not start a conversation"),
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      createReport({
        reason: "Inappropriate conduct",
        reportedUserId: id!,
        details: reportDetails.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Report submitted");
      setShowReportConfirm(false);
    },
    onError: () => {
      toast.error("Failed to submit report");
      setShowReportConfirm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProfile(id!),
    onSuccess: async () => {
      queryClient.clear();
      // Clear client-side session state; the server has already cleared the refresh cookie.
      await logout().catch(() => {});
      toast.success("Your account has been deleted.");
      navigate("/");
    },
    onError: () => toast.error("Failed to delete account"),
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

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateProfile(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      setEditing(false);
      toast.success("Profile updated");
    },
    onError: () => toast.error("Failed to update profile"),
  });

  const startEditing = () => {
    if (!profile) return;
    setEditForm({
      name: profile.name,
      bio: profile.bio || "",
      location: profile.location || "",
      skills: profile.skills.join(", "),
    });
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
    });
  };

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!profile)
    return (
      <div className="text-center py-20 text-gray-500">User not found</div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="relative bg-white rounded-lg border border-gray-200 p-6 mb-8">
        {!isOwnProfile && (
          <button
            type="button"
            onClick={() => setShowReportConfirm(true)}
            aria-label="Report user"
            title="Report user"
            className="absolute top-3 right-3 p-1.5 text-red-600 hover:bg-red-50 rounded"
          >
            <Flag className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
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
            <div>
              {editing ? (
                <input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="text-xl font-bold border border-gray-300 rounded px-2 py-1"
                />
              ) : (
                <h1 className="text-xl font-bold text-gray-900">
                  {profile.name}
                </h1>
              )}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500 mt-1">
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
                  Joined{" "}
                  {formatDistanceToNow(new Date(profile.createdAt), {
                    addSuffix: true,
                  })}
                </span>
                {!!profile.fulfilledCount && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {profile.fulfilledCount}{" "}
                    {profile.fulfilledCount === 1 ? "request" : "requests"}{" "}
                    fulfilled
                  </span>
                )}
              </div>
            </div>
          </div>
          {isOwnProfile && (
            <div>
              {editing ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1 text-green-600 hover:text-green-700"
                  >
                    <Save className="w-4 h-4" /> Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1 text-gray-600 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-x-3 gap-y-2">
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-1 text-gray-600 hover:text-gray-700"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="flex items-center gap-1 text-gray-600 hover:text-gray-700"
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                value={editForm.bio}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, bio: e.target.value }))
                }
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Skills (comma-separated)
              </label>
              <input
                value={editForm.skills}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, skills: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        ) : (
          <>
            {profile.bio && <p className="mt-4 text-gray-700">{profile.bio}</p>}
            {profile.skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {!isOwnProfile && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => messageMutation.mutate()}
              disabled={messageMutation.isPending}
              className="flex items-center gap-1 bg-mayday-500 text-white px-4 py-2 rounded-lg hover:bg-mayday-600 disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              {messageMutation.isPending ? "Starting…" : "Message"}
            </button>
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-4">Posts</h2>
      {postsData ? <PostList posts={postsData.data} /> : <LoadingSpinner />}

      {isOwnProfile && (
        <div className="mt-12 border border-red-200 bg-red-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Danger zone
          </h2>
          <p className="text-sm text-red-700 mb-4">
            Deleting your account removes your profile, posts, messages, and
            reports. Communities and organizations you own will be handed off to
            the next member, or deleted if you're the only member.
          </p>
          {confirmingDelete ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-800">
                This cannot be undone. Are you sure?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  {deleteMutation.isPending
                    ? "Deleting…"
                    : "Yes, delete my account"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1 border border-red-300 bg-white text-red-700 px-4 py-2 rounded-lg hover:bg-red-100"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Delete my account
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
            Report this user?
          </h2>
          <p className="mt-3 text-sm text-gray-700">
            The admin team will review {profile.name}'s profile for
            inappropriate conduct. You can't undo a report, but you can file a
            new one later if needed.
          </p>
          <div className="mt-4">
            <label
              htmlFor="report-user-details"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Additional details{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="report-user-details"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="What happened? Any context that will help the admin team is welcome."
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
              Cancel
            </button>
            <button
              type="button"
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Flag className="w-4 h-4" aria-hidden="true" />
              {reportMutation.isPending ? "Submitting…" : "Report user"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
