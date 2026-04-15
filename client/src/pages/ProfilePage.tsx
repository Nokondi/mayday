import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { User as UserIcon, MapPin, Calendar, Edit2, Save, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { getUser, updateProfile, getUserPosts, uploadUserAvatar } from '../api/users.js';
import { useAuth } from '../context/AuthContext.js';
import { PostList } from '../components/posts/PostList.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { AvatarUploader } from '../components/common/AvatarUploader.js';

export function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', bio: '', location: '', skills: '' });

  const isOwnProfile = authUser?.id === id;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => getUser(id!),
    enabled: !!id,
  });

  const { data: postsData } = useQuery({
    queryKey: ['userPosts', id],
    queryFn: () => getUserPosts(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateProfile(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      setEditing(false);
      toast.success('Profile updated');
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const startEditing = () => {
    if (!profile) return;
    setEditForm({
      name: profile.name,
      bio: profile.bio || '',
      location: profile.location || '',
      skills: profile.skills.join(', '),
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      name: editForm.name,
      bio: editForm.bio || undefined,
      location: editForm.location || undefined,
      skills: editForm.skills.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!profile) return <div className="text-center py-20 text-gray-500">User not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {isOwnProfile ? (
              <AvatarUploader
                currentUrl={profile.avatarUrl}
                fallback={<UserIcon className="w-8 h-8 text-mayday-600" />}
                onUpload={async (file) => {
                  await uploadUserAvatar(id!, file);
                  queryClient.invalidateQueries({ queryKey: ['user', id] });
                }}
                size={64}
              />
            ) : profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 bg-mayday-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-mayday-600" />
              </div>
            )}
            <div>
              {editing ? (
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="text-xl font-bold border border-gray-300 rounded px-2 py-1"
                />
              ) : (
                <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {editing ? (
                      <input
                        value={editForm.location}
                        onChange={(e) => setEditForm(f => ({ ...f, location: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-0.5 text-sm"
                      />
                    ) : profile.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Joined {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
          {isOwnProfile && (
            <div>
              {editing ? (
                <div className="flex gap-2">
                  <button onClick={handleSave} className="flex items-center gap-1 text-green-600 hover:text-green-700">
                    <Save className="w-4 h-4" /> Save
                  </button>
                  <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-gray-600 hover:text-gray-700">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              ) : (
                <button onClick={startEditing} className="flex items-center gap-1 text-gray-600 hover:text-gray-700">
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
              <input
                value={editForm.skills}
                onChange={(e) => setEditForm(f => ({ ...f, skills: e.target.value }))}
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
                  <span key={skill} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-4">Posts</h2>
      {postsData ? (
        <PostList posts={postsData.data} />
      ) : (
        <LoadingSpinner />
      )}
    </div>
  );
}
