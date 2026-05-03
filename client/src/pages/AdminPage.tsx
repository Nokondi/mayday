import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Flag,
  Users,
  Check,
  X,
  Ban,
  Bug,
  Search,
  Megaphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../api/client.js";
import {
  getBugReports,
  updateBugReportStatus,
  type BugReport,
} from "../api/bugReports.js";
import {
  searchUsers,
  setUserBanned,
  type AdminUserRow,
} from "../api/adminUsers.js";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../api/announcements.js";
import type { Announcement } from "@mayday/shared";

interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string; email: string };
  reportedUser: { id: string; name: string; email: string } | null;
  post: { id: string; title: string; type: string } | null;
}

const BUG_STATUSES: BugReport["status"][] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const ADMIN_TABS = ["reports", "bugs", "users", "announcements"] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("reports");

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight" &&
      e.key !== "Home" &&
      e.key !== "End"
    )
      return;
    e.preventDefault();
    const currentIndex = ADMIN_TABS.indexOf(tab);
    let nextIndex = currentIndex;
    if (e.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % ADMIN_TABS.length;
    else if (e.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + ADMIN_TABS.length) % ADMIN_TABS.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = ADMIN_TABS.length - 1;
    const nextTab = ADMIN_TABS[nextIndex];
    setTab(nextTab);
    document.getElementById(`admin-tab-${nextTab}`)?.focus();
  };
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [bugStatusFilter, setBugStatusFilter] = useState<
    BugReport["status"] | "ALL"
  >("OPEN");
  const [userQuery, setUserQuery] = useState("");
  const [debouncedUserQuery, setDebouncedUserQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<
    "ALL" | "USER" | "ADMIN"
  >("ALL");
  const [userBannedFilter, setUserBannedFilter] = useState<
    "ALL" | "BANNED" | "ACTIVE"
  >("ALL");
  const [userPage, setUserPage] = useState(1);
  const queryClient = useQueryClient();

  useEffect(() => {
    const id = setTimeout(() => setDebouncedUserQuery(userQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [userQuery]);

  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserQuery, userRoleFilter, userBannedFilter]);

  const { data: reports } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const res = await api.get("/admin/reports", {
        params: { status: "PENDING" },
      });
      return res.data as { data: Report[]; total: number };
    },
  });

  const { data: bugReports } = useQuery({
    queryKey: ["admin", "bug-reports", bugStatusFilter],
    queryFn: () =>
      getBugReports(bugStatusFilter === "ALL" ? undefined : bugStatusFilter),
    enabled: tab === "bugs",
  });

  const { data: users, isFetching: isFetchingUsers } = useQuery({
    queryKey: [
      "admin",
      "users",
      debouncedUserQuery,
      userRoleFilter,
      userBannedFilter,
      userPage,
    ],
    queryFn: () =>
      searchUsers({
        q: debouncedUserQuery || undefined,
        role: userRoleFilter === "ALL" ? undefined : userRoleFilter,
        banned:
          userBannedFilter === "ALL"
            ? undefined
            : userBannedFilter === "BANNED",
        page: userPage,
        limit: 20,
      }),
    enabled: tab === "users",
    placeholderData: (prev) => prev,
  });

  const resolveReport = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.put(`/admin/reports/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      toast.success("Report updated");
    },
  });

  const changeBugStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BugReport["status"] }) =>
      updateBugReportStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bug-reports"] });
      toast.success("Bug report updated");
    },
    onError: () => toast.error("Failed to update bug report"),
  });

  const banUser = useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) =>
      setUserBanned(id, banned),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(vars.banned ? "User banned" : "User unbanned");
    },
    onError: () => toast.error("Failed to update user"),
  });

  const { data: announcements } = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: listAnnouncements,
    enabled: tab === "announcements",
  });

  const postAnnouncement = useMutation({
    mutationFn: (message: string) => createAnnouncement({ message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcement", "active"] });
      setAnnouncementDraft("");
      toast.success("Announcement posted");
    },
    onError: () => toast.error("Failed to post announcement"),
  });

  const deactivateAnnouncement = useMutation({
    mutationFn: (id: string) => updateAnnouncement(id, { active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcement", "active"] });
      toast.success("Announcement cleared");
    },
    onError: () => toast.error("Failed to clear announcement"),
  });

  const removeAnnouncement = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcement", "active"] });
      toast.success("Announcement deleted");
    },
    onError: () => toast.error("Failed to delete announcement"),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-mayday-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
      </div>

      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- per WAI-ARIA APG, the tablist itself is not focusable; the active tab inside is */}
      <div
        role="tablist"
        aria-label="Admin sections"
        onKeyDown={handleTabKeyDown}
        className="flex gap-4 mb-6"
      >
        <button
          role="tab"
          id="admin-tab-reports"
          aria-selected={tab === "reports"}
          aria-controls="admin-panel-reports"
          tabIndex={tab === "reports" ? 0 : -1}
          onClick={() => setTab("reports")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            tab === "reports"
              ? "bg-mayday-700 text-white"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          <Flag className="w-4 h-4" aria-hidden="true" />{" "}
          <span className="hidden sm:inline">Reports</span>
        </button>
        <button
          role="tab"
          id="admin-tab-bugs"
          aria-selected={tab === "bugs"}
          aria-controls="admin-panel-bugs"
          tabIndex={tab === "bugs" ? 0 : -1}
          onClick={() => setTab("bugs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            tab === "bugs"
              ? "bg-mayday-700 text-white"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          <Bug className="w-4 h-4" aria-hidden="true" />{" "}
          <span className="hidden sm:inline">Bug Reports</span>
        </button>
        <button
          role="tab"
          id="admin-tab-users"
          aria-selected={tab === "users"}
          aria-controls="admin-panel-users"
          tabIndex={tab === "users" ? 0 : -1}
          onClick={() => setTab("users")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            tab === "users"
              ? "bg-mayday-700 text-white"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          <Users className="w-4 h-4" aria-hidden="true" />{" "}
          <span className="hidden sm:inline">Users</span>
        </button>
        <button
          role="tab"
          id="admin-tab-announcements"
          aria-selected={tab === "announcements"}
          aria-controls="admin-panel-announcements"
          tabIndex={tab === "announcements" ? 0 : -1}
          onClick={() => setTab("announcements")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            tab === "announcements"
              ? "bg-mayday-700 text-white"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          <Megaphone className="w-4 h-4" aria-hidden="true" />{" "}
          <span className="hidden sm:inline">Announcements</span>
        </button>
      </div>

      {tab === "reports" && (
        <div
          role="tabpanel"
          id="admin-panel-reports"
          aria-labelledby="admin-tab-reports"
          className="space-y-3"
        >
          {reports?.data.length === 0 && (
            <p className="text-center py-8 text-gray-500">No pending reports</p>
          )}
          {reports?.data.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{report.reason}</p>
                  {report.details && (
                    <p className="text-sm text-gray-600 mt-1">
                      {report.details}
                    </p>
                  )}
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p>
                      Reported by: {report.reporter.name} (
                      {report.reporter.email})
                    </p>
                    {report.reportedUser && (
                      <p>
                        Against:{" "}
                        <Link
                          to={`/profile/${report.reportedUser.id}`}
                          className="text-mayday-600 hover:underline"
                        >
                          {report.reportedUser.name}
                        </Link>
                      </p>
                    )}
                    {report.post && (
                      <p>
                        Post:{" "}
                        <Link
                          to={`/posts/${report.post.id}`}
                          className="text-mayday-600 hover:underline"
                        >
                          {report.post.title}
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      resolveReport.mutate({
                        id: report.id,
                        status: "RESOLVED",
                      })
                    }
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                    aria-label="Resolve report"
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() =>
                      resolveReport.mutate({
                        id: report.id,
                        status: "DISMISSED",
                      })
                    }
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                    aria-label="Dismiss report"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                  {report.reportedUser && (
                    <button
                      onClick={() =>
                        banUser.mutate({
                          id: report.reportedUser!.id,
                          banned: true,
                        })
                      }
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      aria-label={`Ban ${report.reportedUser.name}`}
                    >
                      <Ban className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "bugs" && (
        <div
          role="tabpanel"
          id="admin-panel-bugs"
          aria-labelledby="admin-tab-bugs"
        >
          <div className="flex items-center gap-2 mb-4">
            <label
              htmlFor="bug-status-filter"
              className="text-sm text-gray-700"
            >
              Filter:
            </label>
            <select
              id="bug-status-filter"
              value={bugStatusFilter}
              onChange={(e) =>
                setBugStatusFilter(
                  e.target.value as BugReport["status"] | "ALL",
                )
              }
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="ALL">All</option>
              {BUG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {bugReports?.data.length === 0 && (
              <p className="text-center py-8 text-gray-500">No bug reports</p>
            )}
            {bugReports?.data.map((bug) => (
              <div
                key={bug.id}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{bug.title}</p>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap break-words">
                      {bug.description}
                    </p>
                    <div className="text-xs text-gray-500 mt-2">
                      <p>
                        From: {bug.reporter.name} ({bug.reporter.email})
                      </p>
                      <p>
                        Submitted: {new Date(bug.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <label className="sr-only" htmlFor={`bug-status-${bug.id}`}>
                      Status
                    </label>
                    <select
                      id={`bug-status-${bug.id}`}
                      value={bug.status}
                      onChange={(e) =>
                        changeBugStatus.mutate({
                          id: bug.id,
                          status: e.target.value as BugReport["status"],
                        })
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      {BUG_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "users" && (
        <div
          role="tabpanel"
          id="admin-panel-users"
          aria-labelledby="admin-tab-users"
        >
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                aria-hidden="true"
              />
              <label htmlFor="user-search" className="sr-only">
                Search users
              </label>
              <input
                id="user-search"
                type="search"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search by name or email"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
              />
            </div>
            <label className="sr-only" htmlFor="user-role-filter">
              Role
            </label>
            <select
              id="user-role-filter"
              value={userRoleFilter}
              onChange={(e) =>
                setUserRoleFilter(e.target.value as "ALL" | "USER" | "ADMIN")
              }
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm"
            >
              <option value="ALL">All roles</option>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            <label className="sr-only" htmlFor="user-banned-filter">
              Status
            </label>
            <select
              id="user-banned-filter"
              value={userBannedFilter}
              onChange={(e) =>
                setUserBannedFilter(
                  e.target.value as "ALL" | "BANNED" | "ACTIVE",
                )
              }
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm"
            >
              <option value="ALL">All users</option>
              <option value="ACTIVE">Active</option>
              <option value="BANNED">Banned</option>
            </select>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            {isFetchingUsers && !users && (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            )}
            {users?.data.length === 0 && (
              <p className="text-center py-8 text-gray-500">No users found</p>
            )}
            {users?.data.map((u: AdminUserRow) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {u.avatarUrl ? (
                    <img
                      src={u.avatarUrl}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/profile/${u.id}`}
                        className="font-medium text-gray-900 hover:underline truncate"
                      >
                        {u.name}
                      </Link>
                      {u.role === "ADMIN" && (
                        <span className="text-xs bg-mayday-100 text-mayday-700 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                      {u.isBanned && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          Banned
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{u.email}</p>
                    <p className="text-xs text-gray-500">
                      Joined {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    banUser.mutate({ id: u.id, banned: !u.isBanned })
                  }
                  disabled={banUser.isPending}
                  className={`text-sm px-3 py-1.5 rounded border disabled:opacity-50 ${
                    u.isBanned
                      ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                      : "border-red-300 text-red-700 hover:bg-red-50"
                  }`}
                >
                  {u.isBanned ? "Unban" : "Ban"}
                </button>
              </div>
            ))}
          </div>

          {users && users.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-gray-500">
                Page {users.page} of {users.totalPages} ({users.total} users)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  disabled={userPage <= 1}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setUserPage((p) => p + 1)}
                  disabled={userPage >= users.totalPages}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "announcements" && (
        <div
          role="tabpanel"
          id="admin-panel-announcements"
          aria-labelledby="admin-tab-announcements"
          className="space-y-6"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const message = announcementDraft.trim();
              if (!message) return;
              postAnnouncement.mutate(message);
            }}
            className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
          >
            <label
              htmlFor="announcement-message"
              className="block text-sm font-medium text-gray-700"
            >
              Post a new announcement
            </label>
            <textarea
              id="announcement-message"
              value={announcementDraft}
              onChange={(e) => setAnnouncementDraft(e.target.value)}
              placeholder="A short message to display at the top of the app for all users."
              rows={3}
              maxLength={500}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Posting replaces the current active announcement. Users who
                dismissed a previous announcement will see this new one.
              </p>
              <button
                type="submit"
                disabled={
                  !announcementDraft.trim() || postAnnouncement.isPending
                }
                className="bg-mayday-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-mayday-800 disabled:opacity-50"
              >
                {postAnnouncement.isPending ? "Posting..." : "Post"}
              </button>
            </div>
          </form>

          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Recent announcements
            </h2>
            {announcements?.length === 0 && (
              <p className="text-center py-8 text-gray-500">
                No announcements yet
              </p>
            )}
            <div className="space-y-2">
              {announcements?.map((a: Announcement) => (
                <div
                  key={a.id}
                  className={`bg-white rounded-lg border p-4 flex items-start justify-between gap-4 ${
                    a.active ? "border-mayday-300" : "border-gray-200"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {a.active ? (
                        <span className="text-xs bg-mayday-100 text-mayday-700 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                      {a.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.active && (
                      <button
                        onClick={() => deactivateAnnouncement.mutate(a.id)}
                        disabled={deactivateAnnouncement.isPending}
                        className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={() => removeAnnouncement.mutate(a.id)}
                      disabled={removeAnnouncement.isPending}
                      className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      aria-label="Delete announcement"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
