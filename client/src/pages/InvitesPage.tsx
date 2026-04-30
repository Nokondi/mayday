import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Check, X, Mail, Building2, Users } from 'lucide-react';
import { acceptInvite, declineInvite, getMyInvites } from '../api/organizations.js';
import { acceptCommunityInvite, declineCommunityInvite, getMyCommunityInvites } from '../api/communities.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';

export function InvitesPage() {
  const queryClient = useQueryClient();

  const { data: orgInvites, isLoading: orgLoading } = useQuery({
    queryKey: ['my-invites'],
    queryFn: getMyInvites,
  });

  const { data: communityInvites, isLoading: communityLoading } = useQuery({
    queryKey: ['my-community-invites'],
    queryFn: getMyCommunityInvites,
  });

  const acceptOrgMutation = useMutation({
    mutationFn: acceptInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invites'] });
      queryClient.invalidateQueries({ queryKey: ['my-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Joined organization');
    },
    onError: () => toast.error('Failed to accept invite'),
  });

  const declineOrgMutation = useMutation({
    mutationFn: declineInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invites'] });
      toast.success('Invite declined');
    },
    onError: () => toast.error('Failed to decline invite'),
  });

  const acceptCommunityMutation = useMutation({
    mutationFn: acceptCommunityInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-community-invites'] });
      queryClient.invalidateQueries({ queryKey: ['my-communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      toast.success('Joined community');
    },
    onError: () => toast.error('Failed to accept invite'),
  });

  const declineCommunityMutation = useMutation({
    mutationFn: declineCommunityInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-community-invites'] });
      toast.success('Invite declined');
    },
    onError: () => toast.error('Failed to decline invite'),
  });

  const isLoading = orgLoading || communityLoading;
  const totalInvites = (orgInvites?.length ?? 0) + (communityInvites?.length ?? 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Invites</h1>

      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : totalInvites === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          <Mail className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>You don't have any pending invites.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orgInvites?.map((inv) => (
            <li key={`org-${inv.id}`} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  {inv.organization && (
                    <Link to={`/organizations/${inv.organization.id}`} className="font-semibold text-gray-900 hover:text-mayday-600">
                      {inv.organization.name}
                    </Link>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Organization</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5 ml-6">
                  Invited by {inv.invitedBy.name}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => acceptOrgMutation.mutate(inv.id)}
                  disabled={acceptOrgMutation.isPending}
                  className="flex items-center gap-1 bg-mayday-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-mayday-600 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => declineOrgMutation.mutate(inv.id)}
                  disabled={declineOrgMutation.isPending}
                  className="flex items-center gap-1 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Decline
                </button>
              </div>
            </li>
          ))}
          {communityInvites?.map((inv) => (
            <li key={`comm-${inv.id}`} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  {inv.community && (
                    <Link to={`/communities/${inv.community.id}`} className="font-semibold text-gray-900 hover:text-mayday-600">
                      {inv.community.name}
                    </Link>
                  )}
                  <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Community</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5 ml-6">
                  Invited by {inv.invitedBy.name}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => acceptCommunityMutation.mutate(inv.id)}
                  disabled={acceptCommunityMutation.isPending}
                  className="flex items-center gap-1 bg-mayday-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-mayday-600 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => declineCommunityMutation.mutate(inv.id)}
                  disabled={declineCommunityMutation.isPending}
                  className="flex items-center gap-1 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
