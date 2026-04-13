import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Trash2, UserPlus, ArrowLeft } from 'lucide-react';
import {
  inviteToOrganizationSchema,
  updateOrganizationSchema,
  type InviteToOrganizationRequest,
  type UpdateOrganizationRequest,
} from '@mayday/shared';
import {
  getOrganization,
  getOrganizationInvites,
  inviteToOrganization,
  revokeInvite,
  removeMember,
  updateMemberRole,
  updateOrganization,
} from '../api/organizations.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { useAuth } from '../context/AuthContext.js';

export function OrganizationManagePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => getOrganization(id!),
    enabled: !!id,
  });

  const { data: invites } = useQuery({
    queryKey: ['organization', id, 'invites'],
    queryFn: () => getOrganizationInvites(id!),
    enabled: !!id && (org?.myRole === 'OWNER' || org?.myRole === 'ADMIN'),
  });

  const inviteForm = useForm<InviteToOrganizationRequest>({
    resolver: zodResolver(inviteToOrganizationSchema),
  });

  const editForm = useForm<UpdateOrganizationRequest>({
    resolver: zodResolver(updateOrganizationSchema),
    values: org ? {
      name: org.name,
      description: org.description ?? undefined,
      location: org.location ?? undefined,
      avatarUrl: org.avatarUrl ?? undefined,
    } : undefined,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteToOrganizationRequest) => inviteToOrganization(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id, 'invites'] });
      toast.success('Invite sent');
      inviteForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to send invite'),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeInvite(id!, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id, 'invites'] });
      toast.success('Invite revoked');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(id!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      toast.success('Member removed');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to remove member'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'ADMIN' | 'MEMBER' }) =>
      updateMemberRole(id!, userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      toast.success('Role updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update role'),
  });

  const editMutation = useMutation({
    mutationFn: (data: UpdateOrganizationRequest) => updateOrganization(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!org) return <div className="max-w-3xl mx-auto px-4 py-8">Organization not found.</div>;

  if (org.myRole !== 'OWNER' && org.myRole !== 'ADMIN') {
    navigate(`/organizations/${org.id}`, { replace: true });
    return null;
  }

  const isOwner = org.myRole === 'OWNER';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link to={`/organizations/${org.id}`} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" />
        Back to {org.name}
      </Link>

      {/* Edit org details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Organization Details</h2>
        <form
          onSubmit={editForm.handleSubmit((data) => {
            const clean: UpdateOrganizationRequest = {};
            if (data.name) clean.name = data.name;
            clean.description = data.description || undefined;
            clean.location = data.location || undefined;
            clean.avatarUrl = data.avatarUrl || undefined;
            editMutation.mutate(clean);
          })}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              {...editForm.register('name')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              {...editForm.register('description')}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              {...editForm.register('location')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL</label>
            <input
              {...editForm.register('avatarUrl')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            {editForm.formState.errors.avatarUrl && (
              <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.avatarUrl.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={editMutation.isPending}
            className="bg-mayday-500 text-white px-4 py-2 rounded-lg hover:bg-mayday-600 disabled:opacity-50"
          >
            Save changes
          </button>
        </form>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite a Member</h2>
        <form
          onSubmit={inviteForm.handleSubmit((data) => inviteMutation.mutate(data))}
          className="flex gap-2"
        >
          <input
            type="email"
            {...inviteForm.register('email')}
            placeholder="user@example.com"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="flex items-center gap-1 bg-mayday-500 text-white px-4 py-2 rounded-lg hover:bg-mayday-600 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            Invite
          </button>
        </form>
        {inviteForm.formState.errors.email && (
          <p className="text-red-500 text-sm mt-1">{inviteForm.formState.errors.email.message}</p>
        )}

        {invites && invites.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Pending invites</h3>
            <ul className="divide-y divide-gray-100">
              {invites.map((inv) => (
                <li key={inv.id} className="py-2 flex items-center justify-between">
                  <span className="text-sm text-gray-900">{inv.invitedUser?.name ?? 'Pending invite'}</span>
                  <button
                    onClick={() => revokeMutation.mutate(inv.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
        <ul className="divide-y divide-gray-100">
          {org.members.map((m) => {
            const isSelf = m.userId === user?.id;
            const canChangeRole = isOwner && !isSelf && m.role !== 'OWNER';
            // Owner can remove anyone except themselves; Admin can remove only MEMBERs
            const canRemove =
              !isSelf &&
              m.role !== 'OWNER' &&
              (isOwner || (org.myRole === 'ADMIN' && m.role === 'MEMBER'));

            return (
              <li key={m.id} className="py-3 flex items-center justify-between gap-2">
                <Link to={`/profile/${m.user.id}`} className="text-gray-900 hover:text-mayday-600 flex-1 min-w-0 truncate">
                  {m.user.name} {isSelf && <span className="text-xs text-gray-500">(you)</span>}
                </Link>
                <div className="flex items-center gap-2">
                  {canChangeRole ? (
                    <select
                      value={m.role}
                      onChange={(e) => roleMutation.mutate({ userId: m.userId, role: e.target.value as 'ADMIN' | 'MEMBER' })}
                      className="text-xs border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  ) : (
                    <span className="text-xs uppercase tracking-wider text-gray-500">{m.role}</span>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${m.user.name} from the organization?`)) {
                          removeMutation.mutate(m.userId);
                        }
                      }}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
