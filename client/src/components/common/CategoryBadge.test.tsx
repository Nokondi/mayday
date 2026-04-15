import { render, screen } from '@testing-library/react';
import { CategoryBadge } from './CategoryBadge.js';

describe('CategoryBadge', () => {
  it('renders the category label', () => {
    render(<CategoryBadge category="Food" />);
    expect(screen.getByText('Food')).toBeInTheDocument();
  });

  it('applies the category-specific color classes for known categories', () => {
    render(<CategoryBadge category="Housing" />);
    const badge = screen.getByText('Housing');
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('uses different colors for different known categories', () => {
    const { rerender } = render(<CategoryBadge category="Food" />);
    expect(screen.getByText('Food')).toHaveClass('bg-green-100', 'text-green-800');

    rerender(<CategoryBadge category="Healthcare" />);
    expect(screen.getByText('Healthcare')).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('falls back to the Other color scheme for unknown categories', () => {
    render(<CategoryBadge category="Made Up Category" />);
    const badge = screen.getByText('Made Up Category');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('applies the shared layout/typography classes regardless of category', () => {
    render(<CategoryBadge category="Food" />);
    const badge = screen.getByText('Food');
    expect(badge).toHaveClass('inline-flex', 'rounded-full', 'text-xs', 'font-medium');
  });
});
