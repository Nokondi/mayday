import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FormattedMessage, useIntl } from 'react-intl';
import { createPost } from '../api/posts.js';
import { PostForm } from '../components/posts/PostForm.js';
import { useToastMutation } from '../hooks/useToastMutation.js';
import type { CreatePostRequest } from '@mayday/shared';

export function CreatePostPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createPostMutation = useToastMutation({
    mutationFn: ({ data, images }: { data: CreatePostRequest; images: File[] }) =>
      createPost(data, images),
    successMessage: intl.formatMessage({
      id: 'posts.createPage.successToast',
      defaultMessage: 'Post created!',
    }),
    errorMessage: intl.formatMessage({
      id: 'posts.createPage.failureToast',
      defaultMessage: 'Failed to create post',
    }),
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate(`/posts/${post.id}`);
    },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        <FormattedMessage
          id="posts.createPage.title"
          defaultMessage="Create a Post"
        />
      </h1>
      <div className="bg-white rounded-lg border border-mayday-200 p-6">
        <PostForm
          onSubmit={async (data, images) => {
            await createPostMutation.mutateAsync({ data, images }).catch(() => {});
          }}
          isSubmitting={createPostMutation.isPending}
        />
      </div>
    </div>
  );
}
