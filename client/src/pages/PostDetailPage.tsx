import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Clock, User, MessageSquare, Flag, Trash2, Building2, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { getPost, getPostMatches, deletePost } from '../api/posts.js';
import { startConversation } from '../api/messages.js';
import { createReport } from '../api/users.js';
import { useAuth } from '../context/AuthContext.js';
import { CategoryBadge } from '../components/common/CategoryBadge.js';
import { UrgencyBadge } from '../components/common/UrgencyBadge.js';
import { PostCard } from '../components/posts/PostCard.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  const { data: matches } = useQuery({
    queryKey: ['postMatches', id],
    queryFn: () => getPostMatches(id!),
    enabled: !!id && !!user,
  });

  const contactMutation = useMutation({
    mutationFn: () => startConversation({ participantId: post!.authorId }),
    onSuccess: (conv) => navigate(`/messages?conversation=${conv.id}`),
    onError: () => toast.error('Failed to start conversation'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post deleted');
      navigate('/posts');
    },
  });

  const reportMutation = useMutation({
    mutationFn: () => createReport({ reason: 'Inappropriate content', postId: id }),
    onSuccess: () => toast.success('Report submitted'),
    onError: () => toast.error('Failed to submit report'),
  });

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!post) return <div className="text-center py-20 text-gray-500">Post not found</div>;

  const isOwner = user?.id === post.authorId;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-sm font-semibold uppercase ${post.type === 'REQUEST' ? 'text-orange-600' : 'text-green-600'}`}>
            {post.type === 'REQUEST' ? 'Request' : 'Offer'}
          </span>
          <CategoryBadge category={post.category} />
          <UrgencyBadge urgency={post.urgency} />
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            post.status === 'OPEN' ? 'bg-green-100 text-green-700' :
            post.status === 'FULFILLED' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {post.status}
          </span>
          {post.community && (
            <Link to={`/communities/${post.community.id}`} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100">
              <Lock className="w-3 h-3" />
              {post.community.name}
            </Link>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">{post.title}</h1>

        {post.images?.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4">
            {post.images.map((img) => (
              <a
                key={img.id}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
              >
                <img
                  src={img.url}
                  alt=""
                  className="w-40 h-40 object-cover"
                />
              </a>
            ))}
          </div>
        )}

        <p className="text-gray-700 whitespace-pre-wrap mb-6">{post.description}</p>

        <div className="flex items-center gap-6 text-sm text-gray-500 mb-6">
          {post.organization ? (
            <Link to={`/organizations/${post.organization.id}`} className="flex items-center gap-1 hover:text-mayday-600">
              <Building2 className="w-4 h-4" />
              {post.organization.name}
              <span className="text-gray-400 ml-1">· by {post.author.name}</span>
            </Link>
          ) : (
            <Link to={`/profile/${post.author.id}`} className="flex items-center gap-1 hover:text-mayday-600">
              <User className="w-4 h-4" />
              {post.author.name}
            </Link>
          )}
          {post.location && post.latitude && post.longitude && (
            <Link to={`/map?lat=${post.latitude}&lng=${post.longitude}&zoom=15`} className="flex items-center gap-1 hover:text-mayday-600">
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
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </span>
        </div>

        <div className="flex gap-3">
          {user && !isOwner && (
            <>
              <button
                onClick={() => contactMutation.mutate()}
                disabled={contactMutation.isPending}
                className="flex items-center gap-2 bg-mayday-500 text-white px-4 py-2 rounded-lg hover:bg-mayday-600"
              >
                <MessageSquare className="w-4 h-4" />
                Contact
              </button>
              <button
                onClick={() => reportMutation.mutate()}
                disabled={reportMutation.isPending}
                className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                <Flag className="w-4 h-4" />
                Report
              </button>
            </>
          )}
          {(isOwner || isAdmin) && (
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-2 border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {matches && matches.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {post.type === 'REQUEST' ? 'Matching Offers' : 'Matching Requests'}
          </h2>
          <div className="space-y-3">
            {matches.map((match) => (
              <PostCard key={match.id} post={match} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
