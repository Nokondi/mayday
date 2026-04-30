import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Clock,
  User,
  MessageSquare,
  Flag,
  Trash2,
  Building2,
  Lock,
  CheckCircle,
  RotateCcw,
  Calendar,
  Repeat,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow, format, isSameDay } from "date-fns";
import { formatRecurrence } from "../components/posts/PostCard.js";
import { toast } from "sonner";
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

function ImageCarousel({ images }: { images: { id: string; url: string }[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [images.length]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-carousel-item]");
    const step = card ? card.offsetWidth + 12 : el.clientWidth;
    el.scrollBy({ left: step * direction, behavior: "smooth" });
  };

  const showArrows = images.length > 1;

  return (
    <div className="relative mb-4">
      <div
        ref={scrollerRef}
        className="flex flex-nowrap gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 -mx-1 px-1"
      >
        {images.map((img, i) => (
          <a
            key={img.id}
            href={img.url}
            target="_blank"
            rel="noopener noreferrer"
            data-carousel-item
            className="snap-start shrink-0 block rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
          >
            <img
              src={img.url}
              alt={`Attachment ${i + 1} of ${images.length} (opens in new tab)`}
              className="w-40 h-40 object-cover"
            />
          </a>
        ))}
      </div>
      {showArrows && canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          aria-label="Previous image"
          className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-gray-200 rounded-full p-1.5 shadow"
        >
          <ChevronLeft className="w-4 h-4 text-gray-700" />
        </button>
      )}
      {showArrows && canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          aria-label="Next image"
          className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-gray-200 rounded-full p-1.5 shadow"
        >
          <ChevronRight className="w-4 h-4 text-gray-700" />
        </button>
      )}
    </div>
  );
}

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showFulfillModal, setShowFulfillModal] = useState(false);
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

  const contactMutation = useMutation({
    mutationFn: () => startConversation({ participantId: post!.authorId }),
    onSuccess: (conv) => navigate(`/messages?conversation=${conv.id}`),
    onError: () => toast.error("Failed to start conversation"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post deleted");
      navigate("/posts");
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopenPost(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post", id] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post reopened");
    },
    onError: () => toast.error("Failed to reopen post"),
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      createReport({
        reason: "Inappropriate content",
        postId: id,
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

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!post)
    return (
      <div className="text-center py-20 text-gray-500">Post not found</div>
    );

  const isOwner = user?.id === post.authorId;
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="relative bg-white rounded-lg border border-gray-200 p-6">
        {user && !isOwner && (
          <button
            type="button"
            onClick={() => setShowReportConfirm(true)}
            aria-label="Report post"
            title="Report post"
            className="absolute top-3 right-3 p-1.5 text-red-600 hover:bg-red-50 rounded"
          >
            <Flag className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <span
          className={`text-sm font-semibold uppercase ${post.type === "REQUEST" ? "text-orange-700" : "text-green-700"}`}
        >
          <span className="sr-only">Post type: </span>
          {post.type === "REQUEST" ? "Request" : "Offer"}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{post.title}</h1>
        <div className="flex flex-col items-start sm:flex-row sm:items-center gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={post.category} />
            <UrgencyBadge urgency={post.urgency} />
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                post.status === "OPEN"
                  ? "bg-green-100 text-green-700"
                  : post.status === "FULFILLED"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {post.status}
            </span>
          </div>
          {post.community && (
            <Link
              to={`/communities/${post.community.id}`}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100"
            >
              <Lock className="w-3 h-3" />
              {post.community.name}
            </Link>
          )}
        </div>

        {post.images?.length > 0 && <ImageCarousel images={post.images} />}

        <p className="text-gray-700 whitespace-pre-wrap mb-6">
          {post.description}
        </p>

        {post.status === "FULFILLED" && post.fulfillments?.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Fulfilled by</span>
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
          {post.organization ? (
            <Link
              to={`/organizations/${post.organization.id}`}
              className="flex items-center gap-1 hover:text-mayday-600"
            >
              <Building2 className="w-4 h-4" />
              {post.organization.name}
              <span className="text-gray-500 ml-1">
                · by {post.author.name}
              </span>
            </Link>
          ) : (
            <Link
              to={`/profile/${post.author.id}`}
              className="flex items-center gap-1 hover:text-mayday-600"
            >
              <User className="w-4 h-4" />
              {post.author.name}
            </Link>
          )}
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
              label = `Starts ${format(new Date(post.startAt), dateFmt)}`;
            } else {
              label = `Ends ${format(new Date(post.endAt!), dateFmt)}`;
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
              aria-label="Contact"
              title="Contact"
              className="flex items-center gap-2 bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Contact</span>
            </button>
          )}
          {(isOwner || isAdmin) &&
            post.status === "OPEN" &&
            post.type === "REQUEST" && (
              <button
                onClick={() => setShowFulfillModal(true)}
                aria-label="Mark as Fulfilled"
                title="Mark as Fulfilled"
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Mark as Fulfilled</span>
              </button>
            )}
          {(isOwner || isAdmin) && post.status === "FULFILLED" && (
            <button
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
              aria-label="Reopen"
              title="Reopen"
              className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reopen</span>
            </button>
          )}
          {(isOwner || isAdmin) && (
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              aria-label="Delete"
              title="Delete"
              className="flex items-center gap-2 border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>
      </div>

      {matches && matches.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {post.type === "REQUEST" ? "Matching Offers" : "Matching Requests"}
          </h2>
          <div className="space-y-3">
            {matches.map((match) => (
              <PostCard key={match.id} post={match} />
            ))}
          </div>
        </div>
      )}

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
            Report this post?
          </h2>
          <p className="mt-3 text-sm text-gray-700">
            The admin team will review this post for inappropriate content. You
            can't undo a report, but you can file a new one later if needed.
          </p>
          <div className="mt-4">
            <label
              htmlFor="report-post-details"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Additional details{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              id="report-post-details"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="What's wrong with this post? Any context that will help the admin team is welcome."
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
              {reportMutation.isPending ? "Submitting…" : "Report post"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
