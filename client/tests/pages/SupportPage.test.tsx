import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { SupportPage } from '../../src/pages/SupportPage.js';

// The form is exercised in its own test; stub it here so this test stays
// focused on the page's structural wiring (heading, sections, form slot).
vi.mock('../../src/components/support/BugReportForm.js', () => ({
  BugReportForm: () => <div data-testid="bug-report-form" />,
}));

function renderPage() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SupportPage', () => {
  it('renders a support heading and intro', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /help with mayday/i })).toBeInTheDocument();
  });

  it('has sections for using the site and reporting a bug', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 2, name: /how to use/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /report a bug/i })).toBeInTheDocument();
  });

  it('renders the bug report form in the bug report section', () => {
    renderPage();
    expect(screen.getByTestId('bug-report-form')).toBeInTheDocument();
  });

  it('renders usage topics as collapsible details elements', () => {
    renderPage();
    // At least a few of the expected topic summaries should be present.
    expect(screen.getByText(/Requests and Offers/i)).toBeInTheDocument();
    expect(screen.getByText(/create a post/i)).toBeInTheDocument();
    expect(screen.getByText(/Communities and Organizations/i)).toBeInTheDocument();

    // Ensure each summary is inside a <details> element (so it's collapsible).
    const summary = screen.getByText(/create a post/i).closest('summary');
    expect(summary).not.toBeNull();
    expect(summary!.parentElement!.tagName).toBe('DETAILS');
  });
});
