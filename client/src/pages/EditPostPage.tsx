import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormattedMessage, useIntl } from 'react-intl';
import { getPost, updatePost } from '../api/posts.js';
import { PostForm } from '../components/posts/PostForm.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { useToastMutation } from '../hooks/useToastMutation.js';
import { useAuth } from '../context/AuthContext.js';
import type { CreatePostRequest } from '@mayday/shared';

export function EditPostPage() {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  const updatePostMutation = useToastMutation({
    mutationFn: ({
      data,
      images,
      removeImageIds,
    }: {
      data: CreatePostRequest;
      images: File[];
      removeImageIds: string[];
    }) => updatePost(id!, data, images, removeImageIds),
    successMessage: intl.formatMessage({
      id: 'posts.editPage.successToast',
      defaultMessage: 'Post updated',
    }),
    errorMessage: intl.formatMessage({
      id: 'posts.editPage.failureToast',
      defaultMessage: 'Failed to update post',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate(`/posts/${id}`);
    },
  });

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!post)
    return (
      <div className="text-center py-20 text-gray-500">
        <FormattedMessage
          id="posts.detailPage.notFound"
          defaultMessage="Post not found"
        />
      </div>
    );

  // The server is the source of truth on authorization (it also allows org
  // owners/admins). Mirror the detail page's owner/admin gate here to avoid
  // showing the form to someone who can't save it.
  const canEdit = user?.id === post.authorId || user?.role === 'ADMIN';
  if (!canEdit) return <Navigate to={`/posts/${id}`} replace />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        <FormattedMessage id="posts.editPage.title" defaultMessage="Edit Post" />
      </h1>
      <div className="bg-white rounded-lg border border-mayday-200 p-6">
        <PostForm
          initialPost={post}
          onSubmit={async (data, images, removeImageIds) => {
            await updatePostMutation
              .mutateAsync({ data, images, removeImageIds })
              .catch(() => {});
          }}
          isSubmitting={updatePostMutation.isPending}
        />
      </div>
    </div>
  );
}
