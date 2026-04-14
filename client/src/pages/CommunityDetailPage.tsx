import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, MapPin, Settings, LogOut, Trash2 } from 'lucide-react';
import { getCommunity, removeCommunityMember, deleteCommunity } from '../api/communities.js';
import { PostList } from '../components/posts/PostList.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { useAuth } from '../context/AuthContext.js';
import { getPosts } from '../api/posts.js';

export function CommunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: community, isLoading } = useQuery({
    queryKey: ['community', id],
    queryFn: () => getCommunity(id!),
    enabled: !!id,
  });

  const isMember = !!community?.myRole;

  const { data: postsData } = useQuery({
    queryKey: ['posts', 'community', id],
    queryFn: () => getPosts({ communityId: id, status: 'OPEN', limit: 20 }),
    enabled: !!id && isMember,
  });

  const leaveMutation = useMutation({
    mutationFn: () => removeCommunityMember(id!, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['my-communities'] });
      toast.success('Left community');
      navigate('/communities');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to leave'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCommunity(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['my-communities'] });
      toast.success('Community deleted');
      navigate('/communities');
    },
    onError: () => toast.error('Failed to delete community'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!community) return <div className="max-w-3xl mx-auto px-4 py-8">Community not found.</div>;

  const isOwner = community.myRole === 'OWNER';
  const isAdminOrOwner = isOwner || community.myRole === 'ADMIN';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {community.avatarUrl && (
              <img src={community.avatarUrl} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{community.name}</h1>
              {community.description && (
                <p className="text-gray-700 mt-2 whitespace-pre-wrap">{community.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {community.memberCount} member{community.memberCount !== 1 ? 's' : ''}
                </span>
                {community.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {community.location}
                  </span>
                )}
                {community.myRole && (
                  <span className="text-mayday-600 font-medium">You: {community.myRole.toLowerCase()}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {isAdminOrOwner && (
              <Link
                to={`/communities/${community.id}/manage`}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <Settings className="w-4 h-4" />
                Manage
              </Link>
            )}
            {isMember && !isOwner && (
              <button
                onClick={() => { if (confirm('Leave this community?')) leaveMutation.mutate(); }}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogOut className="w-4 h-4" />
                Leave
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => { if (confirm('Delete this community? This cannot be undone.')) deleteMutation.mutate(); }}
                className="flex items-center gap-1 px-3 py-2 border border-red-300 rounded-lg text-sm text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
        <ul className="divide-y divide-gray-100">
          {community.members.map((m) => (
            <li key={m.id} className="py-3 flex items-center justify-between">
              <Link to={`/profile/${m.user.id}`} className="text-gray-900 hover:text-mayday-600">
                {m.user.name}
              </Link>
              <span className="text-xs uppercase tracking-wider text-gray-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </div>

      {isMember && postsData && postsData.data.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Community Posts</h2>
          <PostList posts={postsData.data} />
        </div>
      )}
    </div>
  );
}
