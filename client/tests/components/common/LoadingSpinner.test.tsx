import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../../../src/components/common/LoadingSpinner.js';

describe('LoadingSpinner', () => {
  it('renders an accessible status region with polite announcements', () => {
    render(<LoadingSpinner />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('provides screen-reader-only loading text', () => {
    render(<LoadingSpinner />);
    const srText = screen.getByText('Loading...');
    expect(srText).toBeInTheDocument();
    expect(srText).toHaveClass('sr-only');
  });

  it('applies the passed className to the status container', () => {
    render(<LoadingSpinner className="my-custom-class" />);
    expect(screen.getByRole('status')).toHaveClass('my-custom-class');
  });

  it('defaults to no extra className when none is provided', () => {
    render(<LoadingSpinner />);
    const status = screen.getByRole('status');
    // Always-present base classes are still applied.
    expect(status).toHaveClass('flex', 'items-center', 'justify-center');
  });
});
