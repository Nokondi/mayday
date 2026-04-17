import type { CreateBugReportRequest, PaginatedResponse } from '@mayday/shared';
import { api } from './client.js';

export interface BugReport {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  reporter: { id: string; name: string; email: string };
}

export async function submitBugReport(data: CreateBugReportRequest): Promise<BugReport> {
  const res = await api.post('/bug-reports', data);
  return res.data;
}

export async function getBugReports(status?: string): Promise<PaginatedResponse<BugReport>> {
  const res = await api.get('/admin/bug-reports', { params: status ? { status } : {} });
  return res.data;
}

export async function updateBugReportStatus(id: string, status: BugReport['status']): Promise<BugReport> {
  const res = await api.put(`/admin/bug-reports/${id}`, { status });
  return res.data;
}
