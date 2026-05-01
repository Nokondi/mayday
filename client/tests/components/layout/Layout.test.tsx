import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// Stub the Header, Footer, and AnnouncementBanner so the Layout test does not
// need to wire up the auth context, react-query client, or icon mocks that
// those components depend on. The Layout's job is to compose them, not to
// reimplement them.
vi.mock('../../../src/components/layout/Header.js', () => ({
  Header: () => <div data-testid="header-stub">HEADER</div>,
}));
vi.mock('../../../src/components/layout/Footer.js', () => ({
  Footer: () => <div data-testid="footer-stub">FOOTER</div>,
}));
vi.mock('../../../src/components/common/AnnouncementBanner.js', () => ({
  AnnouncementBanner: () => null,
}));

import { Layout } from '../../../src/components/layout/Layout.js';

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<div data-testid="outlet-content">HOME</div>} />
          <Route path="/other" element={<div data-testid="outlet-content">OTHER</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  it('renders the Header and Footer', () => {
    renderLayout();
    expect(screen.getByTestId('header-stub')).toBeInTheDocument();
    expect(screen.getByTestId('footer-stub')).toBeInTheDocument();
  });

  it('renders the matched child route via <Outlet />', () => {
    renderLayout('/');
    expect(screen.getByTestId('outlet-content')).toHaveTextContent('HOME');
  });

  it('renders a different child when the route matches elsewhere', () => {
    renderLayout('/other');
    expect(screen.getByTestId('outlet-content')).toHaveTextContent('OTHER');
  });

  it('provides a main landmark with id="main-content" that wraps the outlet', () => {
    renderLayout();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toContainElement(screen.getByTestId('outlet-content'));
  });

  it('renders a skip-to-main-content link that targets the main landmark', () => {
    renderLayout();
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toHaveAttribute('href', '#main-content');
    // Visually hidden by default; revealed on focus via the focus:not-sr-only class.
    expect(skipLink).toHaveClass('sr-only');
  });

  it('orders the DOM as skip-link → header → main → footer', () => {
    const { container } = renderLayout();
    const nodes = [
      screen.getByRole('link', { name: /skip to main content/i }),
      screen.getByTestId('header-stub'),
      screen.getByRole('main'),
      screen.getByTestId('footer-stub'),
    ];
    // Each subsequent node should appear later in document order than the previous.
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const relation = prev.compareDocumentPosition(curr);
      expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // Sanity: everything is inside the rendered tree.
    expect(container).toContainElement(nodes[0]);
  });
});
