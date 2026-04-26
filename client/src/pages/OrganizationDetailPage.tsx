import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, MapPin, CheckCircle2, Settings, LogOut, Trash2 } from 'lucide-react';
import { getOrganization, removeMember, deleteOrganization } from '../api/organizations.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { useAuth } from '../context/AuthContext.js';

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => getOrganization(id!),
    enabled: !!id,
  });

  const leaveMutation = useMutation({
    mutationFn: () => removeMember(id!, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['my-organizations'] });
      toast.success('Left organization');
      navigate('/organizations');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to leave'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrganization(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['my-organizations'] });
      toast.success('Organization deleted');
      navigate('/organizations');
    },
    onError: () => toast.error('Failed to delete organization'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!org) return <div className="max-w-3xl mx-auto px-4 py-8">Organization not found.</div>;

  const isOwner = org.myRole === 'OWNER';
  const isAdminOrOwner = isOwner || org.myRole === 'ADMIN';
  const isMember = !!org.myRole;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {org.avatarUrl && (
              <img src={org.avatarUrl} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
              {org.description && (
                <p className="text-gray-700 mt-2 whitespace-pre-wrap">{org.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {org.memberCount} member{org.memberCount !== 1 ? 's' : ''}
                </span>
                {org.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {org.location}
                  </span>
                )}
                {!!org.fulfilledCount && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {org.fulfilledCount} {org.fulfilledCount === 1 ? 'request' : 'requests'} fulfilled
                  </span>
                )}
                {org.myRole && (
                  <span className="text-mayday-600 font-medium">You: {org.myRole.toLowerCase()}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {isAdminOrOwner && (
              <Link
                to={`/organizations/${org.id}/manage`}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <Settings className="w-4 h-4" />
                Manage
              </Link>
            )}
            {isMember && !isOwner && (
              <button
                onClick={() => {
                  if (confirm('Leave this organization?')) leaveMutation.mutate();
                }}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogOut className="w-4 h-4" />
                Leave
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => {
                  if (confirm('Delete this organization? This cannot be undone.')) deleteMutation.mutate();
                }}
                className="flex items-center gap-1 px-3 py-2 border border-red-300 rounded-lg text-sm text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
        <ul className="divide-y divide-gray-100">
          {org.members.map((m) => (
            <li key={m.id} className="py-3 flex items-center justify-between">
              <Link to={`/profile/${m.user.id}`} className="text-gray-900 hover:text-mayday-600">
                {m.user.name}
              </Link>
              <span className="text-xs uppercase tracking-wider text-gray-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
