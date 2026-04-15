import { render, screen } from '@testing-library/react';
import { UrgencyBadge } from '../../../src/components/common/UrgencyBadge.js';

describe('UrgencyBadge', () => {
  it('renders the human-readable label for a known urgency', () => {
    render(<UrgencyBadge urgency="LOW" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('maps each known urgency to its own color scheme', () => {
    const { rerender } = render(<UrgencyBadge urgency="LOW" />);
    expect(screen.getByText('Low')).toHaveClass('bg-gray-100', 'text-gray-700');

    rerender(<UrgencyBadge urgency="MEDIUM" />);
    expect(screen.getByText('Medium')).toHaveClass('bg-blue-100', 'text-blue-700');

    rerender(<UrgencyBadge urgency="HIGH" />);
    expect(screen.getByText('High')).toHaveClass('bg-orange-100', 'text-orange-700');

    rerender(<UrgencyBadge urgency="CRITICAL" />);
    expect(screen.getByText('Critical')).toHaveClass('bg-red-100', 'text-red-700');
  });

  it('falls back to the MEDIUM label and colors for unknown urgencies', () => {
    render(<UrgencyBadge urgency="SOMETHING_ELSE" />);
    const badge = screen.getByText('Medium');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-700');
  });

  it('applies the shared layout/typography classes regardless of urgency', () => {
    render(<UrgencyBadge urgency="HIGH" />);
    const badge = screen.getByText('High');
    expect(badge).toHaveClass('inline-flex', 'rounded-full', 'text-xs', 'font-medium');
  });
});
