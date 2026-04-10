import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPost } from '../api/posts.js';
import { PostForm } from '../components/posts/PostForm.js';
import type { CreatePostRequest } from '@mayday/shared';

export function CreatePostPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: CreatePostRequest, images: File[]) => {
    setIsSubmitting(true);
    try {
      const post = await createPost(data, images);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post created!');
      navigate(`/posts/${post.id}`);
    } catch {
      toast.error('Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create a Post</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <PostForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </div>
  );
}
