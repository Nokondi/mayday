import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Check, X, Mail } from 'lucide-react';
import { acceptInvite, declineInvite, getMyInvites } from '../api/organizations.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';

export function InvitesPage() {
  const queryClient = useQueryClient();
  const { data: invites, isLoading } = useQuery({
    queryKey: ['my-invites'],
    queryFn: getMyInvites,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invites'] });
      queryClient.invalidateQueries({ queryKey: ['my-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Joined organization');
    },
    onError: () => toast.error('Failed to accept invite'),
  });

  const declineMutation = useMutation({
    mutationFn: declineInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invites'] });
      toast.success('Invite declined');
    },
    onError: () => toast.error('Failed to decline invite'),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Organization Invites</h1>

      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : !invites || invites.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          <Mail className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>You don't have any pending invites.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {invites.map((inv) => (
            <li key={inv.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                {inv.organization && (
                  <Link to={`/organizations/${inv.organization.id}`} className="font-semibold text-gray-900 hover:text-mayday-600">
                    {inv.organization.name}
                  </Link>
                )}
                <p className="text-sm text-gray-500 mt-0.5">
                  Invited by {inv.invitedBy.name}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => acceptMutation.mutate(inv.id)}
                  disabled={acceptMutation.isPending}
                  className="flex items-center gap-1 bg-mayday-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-mayday-600 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => declineMutation.mutate(inv.id)}
                  disabled={declineMutation.isPending}
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
