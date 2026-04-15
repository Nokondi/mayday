import { render, screen } from '@testing-library/react';
import { Footer } from '../../../src/components/layout/Footer.js';

describe('Footer', () => {
  it('renders as a contentinfo landmark', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders the "Built with love for community" attribution with screen-reader text', () => {
    render(<Footer />);
    // The heart icon has aria-hidden; the word "love" is provided via sr-only.
    expect(screen.getByText(/built with/i)).toBeInTheDocument();
    const srLove = screen.getByText('love');
    expect(srLove).toHaveClass('sr-only');
    expect(screen.getByText(/for community/i)).toBeInTheDocument();
  });

  it('renders the product name', () => {
    render(<Footer />);
    expect(screen.getByText('MayDay Mutual Aid Hub')).toBeInTheDocument();
  });
});
