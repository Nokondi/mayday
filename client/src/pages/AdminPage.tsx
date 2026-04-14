import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Flag, Users, Check, X, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api/client.js';

interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string; email: string };
  reportedUser: { id: string; name: string; email: string } | null;
  post: { id: string; title: string; type: string } | null;
}

export function AdminPage() {
  const [tab, setTab] = useState<'reports' | 'users'>('reports');
  const queryClient = useQueryClient();

  const { data: reports } = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: async () => {
      const res = await api.get('/admin/reports', { params: { status: 'PENDING' } });
      return res.data as { data: Report[]; total: number };
    },
  });

  const resolveReport = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.put(`/admin/reports/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      toast.success('Report updated');
    },
  });

  const banUser = useMutation({
    mutationFn: async ({ id, banned }: { id: string; banned: boolean }) => {
      await api.put(`/admin/users/${id}/ban`, { banned });
    },
    onSuccess: () => {
      toast.success('User status updated');
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-mayday-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            tab === 'reports' ? 'bg-mayday-500 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          <Flag className="w-4 h-4" /> Reports
        </button>
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            tab === 'users' ? 'bg-mayday-500 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" /> Users
        </button>
      </div>

      {tab === 'reports' && (
        <div className="space-y-3">
          {reports?.data.length === 0 && (
            <p className="text-center py-8 text-gray-500">No pending reports</p>
          )}
          {reports?.data.map((report) => (
            <div key={report.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{report.reason}</p>
                  {report.details && <p className="text-sm text-gray-600 mt-1">{report.details}</p>}
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p>Reported by: {report.reporter.name} ({report.reporter.email})</p>
                    {report.reportedUser && <p>Against: {report.reportedUser.name}</p>}
                    {report.post && <p>Post: {report.post.title}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveReport.mutate({ id: report.id, status: 'RESOLVED' })}
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                    aria-label="Resolve report"
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => resolveReport.mutate({ id: report.id, status: 'DISMISSED' })}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                    aria-label="Dismiss report"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                  {report.reportedUser && (
                    <button
                      onClick={() => banUser.mutate({ id: report.reportedUser!.id, banned: true })}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      aria-label={`Ban ${report.reportedUser.name}`}
                    >
                      <Ban className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
          User search and management coming soon.
        </div>
      )}
    </div>
  );
}
