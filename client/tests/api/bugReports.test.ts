import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import { api } from '../../src/api/client.js';
import {
  submitBugReport,
  getBugReports,
  updateBugReportStatus,
} from '../../src/api/bugReports.js';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe('submitBugReport', () => {
  it('POSTs /bug-reports with the payload', async () => {
    const body = { id: 'b1', title: 'T', description: 'D', status: 'OPEN' };
    mockedApi.post.mockResolvedValueOnce({ data: body });

    const result = await submitBugReport({ title: 'T', description: 'D' });

    expect(mockedApi.post).toHaveBeenCalledWith('/bug-reports', { title: 'T', description: 'D' });
    expect(result).toEqual(body);
  });
});

describe('getBugReports', () => {
  it('GETs /admin/bug-reports with no status filter when omitted', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [] } });
    await getBugReports();
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/bug-reports', { params: {} });
  });

  it('passes status as a query param when provided', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [] } });
    await getBugReports('OPEN');
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/bug-reports', { params: { status: 'OPEN' } });
  });
});

describe('updateBugReportStatus', () => {
  it('PUTs /admin/bug-reports/:id with { status }', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: { id: 'b1', status: 'RESOLVED' } });
    const result = await updateBugReportStatus('b1', 'RESOLVED');
    expect(mockedApi.put).toHaveBeenCalledWith('/admin/bug-reports/b1', { status: 'RESOLVED' });
    expect(result).toEqual({ id: 'b1', status: 'RESOLVED' });
  });
});
