import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/api/client.js', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('../../src/api/bugReports.js', () => ({
  getBugReports: vi.fn().mockResolvedValue({ data: [] }),
  updateBugReportStatus: vi.fn(),
}));

vi.mock('../../src/api/adminUsers.js', () => ({
  searchUsers: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
  setUserBanned: vi.fn(),
}));

import { api } from '../../src/api/client.js';
import { AdminPage } from '../../src/pages/AdminPage.js';

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    reason: 'Spam',
    details: null,
    status: 'PENDING',
    createdAt: '2026-04-22T00:00:00Z',
    reporter: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
    reportedUser: null,
    post: { id: 'p1', title: 'A shady post', type: 'REQUEST' },
    ...overrides,
  };
}

function renderAdmin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminPage — report post linking', () => {
  it('renders the reported post title as a clickable link to /posts/:id', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [makeReport()], total: 1 } });

    renderAdmin();

    const link = await screen.findByRole('link', { name: /a shady post/i });
    expect(link).toHaveAttribute('href', '/posts/p1');
  });

  it('does not render a Post row when the report has no associated post', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { data: [makeReport({ post: null })], total: 1 },
    });

    renderAdmin();

    // Wait for the report to render.
    await screen.findByText(/spam/i);
    expect(screen.queryByText(/^Post:/)).not.toBeInTheDocument();
  });

  it('renders the reporter\'s additional details below the reason when present', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        data: [
          makeReport({ details: 'They posted a scam asking for gift cards.' }),
        ],
        total: 1,
      },
    });

    renderAdmin();

    expect(
      await screen.findByText(/They posted a scam asking for gift cards\./),
    ).toBeInTheDocument();
  });

  it('renders the reported user\'s name as a clickable link to their profile', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        data: [
          makeReport({
            post: null,
            reportedUser: { id: 'u9', name: 'Bad Actor', email: 'bad@example.com' },
          }),
        ],
        total: 1,
      },
    });

    renderAdmin();

    const link = await screen.findByRole('link', { name: /bad actor/i });
    expect(link).toHaveAttribute('href', '/profile/u9');
  });
});
