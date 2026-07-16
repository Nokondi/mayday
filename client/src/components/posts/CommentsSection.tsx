import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FormattedMessage, useIntl } from "react-intl";
import type { CommentWithAuthor } from "@mayday/shared";
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from "../../api/comments.js";
import { useToastMutation } from "../../hooks/useToastMutation.js";
import { useAuth } from "../../context/AuthContext.js";
import { LoadingSpinner } from "../common/LoadingSpinner.js";

const MAX_LENGTH = 2000;

/**
 * Composer used both for new comments and for editing an existing one. In edit
 * mode it is seeded with `initialBody` and calls `onSubmit` with the new text;
 * the parent owns the mutation so the same form serves both cases.
 */
function CommentForm({
  initialBody = "",
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initialBody?: string;
  submitLabel: React.ReactNode;
  pending: boolean;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
}) {
  const intl = useIntl();
  const [body, setBody] = useState(initialBody);
  const trimmed = body.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={MAX_LENGTH}
        placeholder={intl.formatMessage({
          id: "comments.form.placeholder",
          defaultMessage: "Add a comment…",
        })}
        className="w-full border border-mayday-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
      />
      <div className="mt-2 flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 rounded-lg border border-mayday-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <FormattedMessage
              id="common.actions.cancel"
              defaultMessage="Cancel"
            />
          </button>
        )}
        <button
          type="submit"
          disabled={pending || !trimmed}
          className="bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  postId,
  canModerate,
}: {
  comment: CommentWithAuthor;
  postId: string;
  canModerate: boolean;
}) {
  const intl = useIntl();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const isAuthor = user?.id === comment.authorId;
  const canDelete = isAuthor || canModerate;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    queryClient.invalidateQueries({ queryKey: ["post", postId] });
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  };

  const editMutation = useToastMutation({
    mutationFn: (body: string) => updateComment(postId, comment.id, body),
    errorMessage: intl.formatMessage({
      id: "comments.editFailedToast",
      defaultMessage: "Failed to save comment",
    }),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });

  const deleteMutation = useToastMutation({
    mutationFn: () => deleteComment(postId, comment.id),
    successMessage: intl.formatMessage({
      id: "comments.deleteSuccessToast",
      defaultMessage: "Comment deleted",
    }),
    errorMessage: intl.formatMessage({
      id: "comments.deleteFailedToast",
      defaultMessage: "Failed to delete comment",
    }),
    onSuccess: invalidate,
  });

  return (
    <div className="border border-mayday-200 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/profile/${comment.author.id}`}
          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-mayday-600"
        >
          <User className="w-4 h-4" aria-hidden="true" />
          {comment.author.name}
        </Link>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>
            {formatDistanceToNow(new Date(comment.createdAt), {
              addSuffix: true,
            })}
          </span>
          {comment.editedAt && (
            <span className="italic">
              <FormattedMessage
                id="comments.editedTag"
                defaultMessage="(edited)"
              />
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-2">
          <CommentForm
            initialBody={comment.body}
            pending={editMutation.isPending}
            onSubmit={(body) => editMutation.mutate(body)}
            onCancel={() => setEditing(false)}
            submitLabel={
              <FormattedMessage
                id="common.actions.save"
                defaultMessage="Save"
              />
            }
          />
        </div>
      ) : (
        <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap break-words">
          {comment.body}
        </p>
      )}

      {!editing && (isAuthor || canDelete) && (
        <div className="mt-2 flex gap-3">
          {isAuthor && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-mayday-600"
            >
              <Pencil className="w-3 h-3" aria-hidden="true" />
              <FormattedMessage
                id="common.actions.edit"
                defaultMessage="Edit"
              />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              <FormattedMessage
                id="common.actions.delete"
                defaultMessage="Delete"
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CommentsSection({
  postId,
  canModerate,
}: {
  postId: string;
  canModerate: boolean;
}) {
  const intl = useIntl();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: comments, isLoading } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => getComments(postId),
  });

  const createMutation = useToastMutation({
    mutationFn: (body: string) => createComment(postId, body),
    errorMessage: intl.formatMessage({
      id: "comments.createFailedToast",
      defaultMessage: "Failed to post comment",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  return (
    <div className="space-y-4">
      {user && (
        <CommentForm
          key={comments?.length ?? 0}
          pending={createMutation.isPending}
          onSubmit={(body) => createMutation.mutate(body)}
          submitLabel={
            <FormattedMessage
              id="comments.form.submit"
              defaultMessage="Comment"
            />
          }
        />
      )}

      {isLoading ? (
        <LoadingSpinner className="py-8" />
      ) : comments && comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              canModerate={canModerate}
            />
          ))}
        </div>
      ) : (
        <p className="text-center py-8 text-gray-600 text-sm">
          <FormattedMessage
            id="comments.empty"
            defaultMessage="No comments yet. Be the first to comment."
          />
        </p>
      )}
    </div>
  );
}
