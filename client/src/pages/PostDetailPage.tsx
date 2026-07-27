import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToastMutation } from "../hooks/useToastMutation.js";
import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Clock,
  User,
  MessageSquare,
  Flag,
  Pencil,
  Trash2,
  Building2,
  Lock,
  CheckCircle,
  RotateCcw,
  Calendar,
  Repeat,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { formatDistanceToNow, format, isSameDay } from "date-fns";
import { FormattedMessage, useIntl } from "react-intl";
import {
  formatRecurrence,
  typeLabels,
  statusLabels,
} from "../components/posts/PostCard.js";
import {
  getPost,
  getPostMatches,
  deletePost,
  reopenPost,
} from "../api/posts.js";
import { startConversation } from "../api/messages.js";
import { createReport } from "../api/users.js";
import { useAuth } from "../context/AuthContext.js";
import { CategoryBadge } from "../components/common/CategoryBadge.js";
import { UrgencyBadge } from "../components/common/UrgencyBadge.js";
import { PostCard } from "../components/posts/PostCard.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { FulfillModal } from "../components/posts/FulfillModal.js";
import { CommentsSection } from "../components/posts/CommentsSection.js";

function ImageCarousel({ images }: { images: { id: string; url: string }[] }) {
  const intl = useIntl();
  const lightboxRef = useRef<HTMLDialogElement>(null);
  // One index drives both the inline image and the lightbox, so opening the
  // lightbox shows the image being viewed and navigation stays in sync.
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const dialog = lightboxRef.current;
    if (!dialog) return;
    if (lightboxOpen && !dialog.open) dialog.showModal();
    else if (!lightboxOpen && dialog.open) dialog.close();
  }, [lightboxOpen]);

  // Keep state in sync when the dialog closes on its own (e.g. Escape).
  useEffect(() => {
    const dialog = lightboxRef.current;
    if (!dialog) return;
    const handleClose = () => setLightboxOpen(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  const handleLightboxKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (!lightboxOpen) return;
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      setIndex(index - 1);
    } else if (e.key === "ArrowRight" && index < images.length - 1) {
      e.preventDefault();
      setIndex(index + 1);
    }
  };

  const showArrows = images.length > 1;
  const imageLabel = intl.formatMessage(
    {
      id: "posts.imageCarousel.imageAlt",
      defaultMessage: "Attachment {n} of {total}",
    },
    { n: index + 1, total: images.length },
  );
  const prevLabel = intl.formatMessage({
    id: "posts.imageCarousel.previousAria",
    defaultMessage: "Previous image",
  });
  const nextLabel = intl.formatMessage({
    id: "posts.imageCarousel.nextAria",
    defaultMessage: "Next image",
  });

  return (
    <div className="mb-4">
      <div className="flex justify-center">
        <div className="relative">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block rounded-lg overflow-hidden border border-mayday-200 hover:shadow-md transition-shadow"
          >
            <img
              src={images[index].url}
              alt={imageLabel}
              className="w-96 max-w-full aspect-square object-cover"
            />
          </button>
          {showArrows && index > 0 && (
            <button
              type="button"
              onClick={() => setIndex(index - 1)}
              aria-label={prevLabel}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-mayday-200 rounded-full p-1.5 shadow"
            >
              <ChevronLeft
                className="w-5 h-5 text-gray-700"
                aria-hidden="true"
              />
            </button>
          )}
          {showArrows && index < images.length - 1 && (
            <button
              type="button"
              onClick={() => setIndex(index + 1)}
              aria-label={nextLabel}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-mayday-200 rounded-full p-1.5 shadow"
            >
              <ChevronRight
                className="w-5 h-5 text-gray-700"
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>
      <dialog
        ref={lightboxRef}
        onKeyDown={handleLightboxKeyDown}
        aria-label={lightboxOpen ? imageLabel : undefined}
        className="rounded-lg p-0 backdrop:bg-black/70"
      >
        {lightboxOpen && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label={intl.formatMessage({
                id: "common.actions.close",
                defaultMessage: "Close",
              })}
              title={intl.formatMessage({
                id: "common.actions.close",
                defaultMessage: "Close",
              })}
              className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow"
            >
              <X className="w-5 h-5 text-gray-700" aria-hidden="true" />
            </button>
            {showArrows && index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                aria-label={prevLabel}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-mayday-200 rounded-full p-1.5 shadow"
              >
                <ChevronLeft
                  className="w-5 h-5 text-gray-700"
                  aria-hidden="true"
                />
              </button>
            )}
            {showArrows && index < images.length - 1 && (
              <button
                type="button"
                onClick={() => setIndex(index + 1)}
                aria-label={nextLabel}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-mayday-200 rounded-full p-1.5 shadow"
              >
                <ChevronRight
                  className="w-5 h-5 text-gray-700"
                  aria-hidden="true"
                />
              </button>
            )}
            <img
              src={images[index].url}
              alt=""
              className="max-w-[90vw] max-h-[85vh] object-contain"
            />
          </div>
        )}
      </dialog>
    </div>
  );
}

export function PostDetailPage() {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "related">(
    "comments",
  );
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

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  const { data: matches } = useQuery({
    queryKey: ["postMatches", id],
    queryFn: () => getPostMatches(id!),
    enabled: !!id && !!user,
  });

  const contactMutation = useToastMutation({
    mutationFn: () => startConversation({ participantId: post!.authorId }),
    errorMessage: intl.formatMessage({
      id: "posts.detailPage.contactFailedToast",
      defaultMessage: "Failed to start conversation",
    }),
    onSuccess: (conv) => {
      const draft = intl.formatMessage(
        {
          id: "posts.detailPage.messageDraftPrefix",
          defaultMessage: "Re: {title} ",
        },
        { title: post!.title },
      );
      navigate(`/messages?conversation=${conv.id}`, { state: { draft } });
    },
  });

  const deleteMutation = useToastMutation({
    mutationFn: () => deletePost(id!),
    successMessage: intl.formatMessage({
      id: "posts.detailPage.deleteSuccessToast",
      defaultMessage: "Post deleted",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      navigate("/");
    },
  });

  const reopenMutation = useToastMutation({
    mutationFn: () => reopenPost(id!),
    successMessage: intl.formatMessage({
      id: "posts.detailPage.reopenSuccessToast",
      defaultMessage: "Post reopened",
    }),
    errorMessage: intl.formatMessage({
      id: "posts.detailPage.reopenFailedToast",
      defaultMessage: "Failed to reopen post",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post", id] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const reportMutation = useToastMutation({
    mutationFn: () =>
      createReport({
        reason: "Inappropriate content",
        postId: id,
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

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!post)
    return (
      <div className="text-center py-20 text-gray-600">
        <FormattedMessage
          id="posts.detailPage.notFound"
          defaultMessage="Post not found"
        />
      </div>
    );

  const isOwner = user?.id === post.authorId;
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="relative bg-white rounded-lg border border-mayday-200 p-6">
        {user && (
          <div className="absolute top-3 right-3 flex items-center gap-1">
            {!isOwner && (
              <button
                type="button"
                onClick={() => setShowReportConfirm(true)}
                aria-label={intl.formatMessage({
                  id: "posts.actions.reportPost",
                  defaultMessage: "Report post",
                })}
                title={intl.formatMessage({
                  id: "posts.actions.reportPost",
                  defaultMessage: "Report post",
                })}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
              >
                <Flag className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            {(isOwner || isAdmin) && (
              <>
                <Link
                  to={`/posts/${post.id}/edit`}
                  aria-label={intl.formatMessage({
                    id: "posts.actions.edit",
                    defaultMessage: "Edit",
                  })}
                  title={intl.formatMessage({
                    id: "posts.actions.edit",
                    defaultMessage: "Edit",
                  })}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                </Link>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  aria-label={intl.formatMessage({
                    id: "posts.actions.delete",
                    defaultMessage: "Delete",
                  })}
                  title={intl.formatMessage({
                    id: "posts.actions.delete",
                    defaultMessage: "Delete",
                  })}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        )}
        <div className={`flex items-start gap-3 mb-3 ${user ? "pr-28" : ""}`}>
          <Link
            to={`/profile/${post.author.id}`}
            tabIndex={-1}
            aria-hidden="true"
            className="shrink-0 mt-1"
          >
            {post.author.avatarUrl ? (
              <img
                src={post.author.avatarUrl}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-mayday-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-mayday-600" aria-hidden="true" />
              </div>
            )}
          </Link>
          <div className="min-w-0">
            <Link
              to={`/profile/${post.author.id}`}
              className="block font-semibold text-gray-900 hover:text-mayday-700 truncate"
            >
              {post.author.name}
            </Link>
            {post.organization && (
              <Link
                to={`/organizations/${post.organization.id}`}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-mayday-600"
              >
                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                {post.organization.name}
              </Link>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{post.title}</h1>
          </div>
        </div>
        {post.images?.length > 0 && <ImageCarousel images={post.images} />}

        <p className="text-gray-700 whitespace-pre-wrap mb-3">
          {post.description}
        </p>

        <div className="flex flex-col items-start sm:flex-row sm:items-center gap-2 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                post.type === "REQUEST"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              <span className="sr-only">
                <FormattedMessage
                  id="posts.typeAriaPrefix"
                  defaultMessage="Post type: "
                />
              </span>
              {intl.formatMessage(typeLabels[post.type])}
            </span>
            <CategoryBadge category={post.category} />
            <UrgencyBadge urgency={post.urgency} />
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                post.status === "OPEN"
                  ? "bg-green-100 text-green-700"
                  : post.status === "FULFILLED"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {intl.formatMessage(statusLabels[post.status])}
            </span>
          </div>
          {post.communities.map((community) => (
            <Link
              key={community.id}
              to={`/communities/${community.id}`}
              className="flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100"
            >
              <Lock className="w-3 h-3" />
              {community.name}
            </Link>
          ))}
        </div>

        {post.status === "FULFILLED" && post.fulfillments?.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">
                <FormattedMessage
                  id="posts.detailPage.fulfilledByHeading"
                  defaultMessage="Fulfilled by"
                />
              </span>
            </div>
            <ul className="space-y-1">
              {post.fulfillments.map((f) => (
                <li key={f.id} className="text-sm text-blue-800">
                  {f.userId ? (
                    <Link
                      to={`/profile/${f.userId}`}
                      className="hover:underline font-medium"
                    >
                      {f.name}
                    </Link>
                  ) : f.organizationId ? (
                    <Link
                      to={`/organizations/${f.organizationId}`}
                      className="hover:underline font-medium"
                    >
                      {f.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{f.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-x-6 gap-y-2 text-sm leading-none text-gray-500 mb-6 flex-wrap sm:gap-1">
          {post.location && post.latitude && post.longitude && (
            <Link
              to={`/map?lat=${post.latitude}&lng=${post.longitude}&zoom=15`}
              className="flex items-center gap-1 hover:text-mayday-600"
            >
              <MapPin className="w-4 h-4" />
              {post.location}
            </Link>
          )}
          {post.location && (!post.latitude || !post.longitude) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {post.location}
            </span>
          )}
          {(() => {
            if (!post.startAt && !post.endAt) return null;
            const dateFmt = "MMM d, yyyy h:mm a";
            const timeFmt = "h:mm a";
            let label: string;
            if (post.startAt && post.endAt) {
              const start = new Date(post.startAt);
              const end = new Date(post.endAt);
              label = isSameDay(start, end)
                ? `${format(start, dateFmt)} – ${format(end, timeFmt)}`
                : `${format(start, dateFmt)} – ${format(end, dateFmt)}`;
            } else if (post.startAt) {
              label = intl.formatMessage(
                {
                  id: "posts.schedule.startsAt",
                  defaultMessage: "Starts {date}",
                },
                { date: format(new Date(post.startAt), dateFmt) },
              );
            } else {
              label = intl.formatMessage(
                { id: "posts.schedule.endsAt", defaultMessage: "Ends {date}" },
                { date: format(new Date(post.endAt!), dateFmt) },
              );
            }
            return (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {label}
              </span>
            );
          })()}
          {(() => {
            const repeat = formatRecurrence(
              intl,
              post.recurrenceFreq,
              post.recurrenceInterval,
            );
            return repeat ? (
              <span className="flex items-center gap-1">
                <Repeat className="w-4 h-4" />
                {repeat}
              </span>
            ) : null;
          })()}
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </span>
        </div>

        <div className="flex gap-3">
          {user && !isOwner && (
            <button
              onClick={() => contactMutation.mutate()}
              disabled={contactMutation.isPending}
              aria-label={intl.formatMessage({
                id: "posts.actions.contact",
                defaultMessage: "Contact",
              })}
              title={intl.formatMessage({
                id: "posts.actions.contact",
                defaultMessage: "Contact",
              })}
              className="flex items-center gap-1.5 text-sm text-mayday-700 border border-mayday-300 px-3 py-1.5 rounded-lg hover:bg-mayday-50 disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">
                <FormattedMessage
                  id="posts.actions.contact"
                  defaultMessage="Contact"
                />
              </span>
            </button>
          )}
          {(isOwner || isAdmin) &&
            post.status === "OPEN" &&
            post.type === "REQUEST" && (
              <button
                onClick={() => setShowFulfillModal(true)}
                aria-label={intl.formatMessage({
                  id: "posts.actions.markAsFulfilled",
                  defaultMessage: "Mark as Fulfilled",
                })}
                title={intl.formatMessage({
                  id: "posts.actions.markAsFulfilled",
                  defaultMessage: "Mark as Fulfilled",
                })}
                className="flex items-center gap-1.5 text-sm text-green-700 border border-green-300 px-3 py-1.5 rounded-lg hover:bg-green-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">
                  <FormattedMessage
                    id="posts.actions.markAsFulfilled"
                    defaultMessage="Mark as Fulfilled"
                  />
                </span>
              </button>
            )}
          {(isOwner || isAdmin) && post.status === "FULFILLED" && (
            <button
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
              aria-label={intl.formatMessage({
                id: "posts.actions.reopen",
                defaultMessage: "Reopen",
              })}
              title={intl.formatMessage({
                id: "posts.actions.reopen",
                defaultMessage: "Reopen",
              })}
              className="flex items-center gap-2 border border-mayday-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">
                <FormattedMessage
                  id="posts.actions.reopen"
                  defaultMessage="Reopen"
                />
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div
          role="tablist"
          aria-label={intl.formatMessage({
            id: "posts.detailPage.tabsAria",
            defaultMessage: "Comments and related posts",
          })}
          className="flex gap-1 border-b border-mayday-200 mb-4"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "comments"}
            onClick={() => setActiveTab("comments")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              activeTab === "comments"
                ? "border-mayday-800 text-mayday-800"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <FormattedMessage
              id="posts.detailPage.commentsTab"
              defaultMessage="Comments ({count})"
              values={{ count: post.commentCount }}
            />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "related"}
            onClick={() => setActiveTab("related")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              activeTab === "related"
                ? "border-mayday-800 text-mayday-800"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {post.type === "REQUEST" ? (
              <FormattedMessage
                id="posts.detailPage.matchingOffers"
                defaultMessage="Matching Offers"
              />
            ) : (
              <FormattedMessage
                id="posts.detailPage.matchingRequests"
                defaultMessage="Matching Requests"
              />
            )}
          </button>
        </div>

        {activeTab === "comments" ? (
          <CommentsSection postId={post.id} canModerate={isAdmin} />
        ) : matches && matches.length > 0 ? (
          <div className="space-y-3">
            {matches.map((match) => (
              <PostCard key={match.id} post={match} />
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-gray-600 text-sm">
            {post.type === "REQUEST" ? (
              <FormattedMessage
                id="posts.detailPage.noMatchingOffers"
                defaultMessage="No matching offers yet."
              />
            ) : (
              <FormattedMessage
                id="posts.detailPage.noMatchingRequests"
                defaultMessage="No matching requests yet."
              />
            )}
          </p>
        )}
      </div>

      <FulfillModal
        postId={id!}
        open={showFulfillModal}
        onClose={() => setShowFulfillModal(false)}
      />

      <dialog
        ref={reportDialogRef}
        aria-labelledby="report-confirm-title"
        className="rounded-lg p-0 backdrop:bg-black/50 max-w-md w-full"
      >
        <div className="p-6">
          <h2
            id="report-confirm-title"
            className="text-lg font-semibold text-gray-900 flex items-center gap-2"
          >
            <Flag className="w-5 h-5 text-red-600" aria-hidden="true" />
            <FormattedMessage
              id="posts.detailPage.reportDialogTitle"
              defaultMessage="Report this post?"
            />
          </h2>
          <p className="mt-3 text-sm text-gray-700">
            <FormattedMessage
              id="posts.detailPage.reportDialogBody"
              defaultMessage="The admin team will review this post for inappropriate content. You can't undo a report, but you can file a new one later if needed."
            />
          </p>
          <div className="mt-4">
            <label
              htmlFor="report-post-details"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              <FormattedMessage
                id="report.detailsLabel"
                defaultMessage="Additional details"
              />
              <span className="text-gray-500 font-normal ml-1">
                <FormattedMessage
                  id="common.formField.optionalSuffix"
                  defaultMessage="(optional)"
                />
              </span>
            </label>
            <textarea
              id="report-post-details"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={intl.formatMessage({
                id: "posts.detailPage.reportDetailsPlaceholder",
                defaultMessage:
                  "What's wrong with this post? Any context that will help the admin team is welcome.",
              })}
              className="w-full border border-mayday-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowReportConfirm(false)}
              disabled={reportMutation.isPending}
              className="px-4 py-2 rounded-lg border border-mayday-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
                  id="posts.actions.reportPost"
                  defaultMessage="Report post"
                />
              )}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
