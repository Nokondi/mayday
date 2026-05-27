import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WaveDivider } from '../../../src/components/common/WaveDivider.js';

function renderDivider(className?: string) {
  const { container } = render(<WaveDivider className={className} />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('WaveDivider did not render an svg');
  return svg;
}

describe('WaveDivider', () => {
  it('renders three wave paths', () => {
    const svg = renderDivider();
    expect(svg.querySelectorAll('path')).toHaveLength(3);
  });

  it('draws strokes with no fill', () => {
    const svg = renderDivider();
    // The svg disables fill, and every path is a stroke (no fill-* class).
    expect(svg).toHaveAttribute('fill', 'none');
    svg.querySelectorAll('path').forEach((path) => {
      expect(path.getAttribute('class')).toMatch(/\bstroke-/);
      expect(path.getAttribute('class')).not.toMatch(/\bfill-/);
    });
  });

  it('keeps the wave curves open (no closing fill segment)', () => {
    const svg = renderDivider();
    // A closed fill shape ended with "...L1440,0 L0,0 Z"; open stroke paths must not.
    svg.querySelectorAll('path').forEach((path) => {
      expect(path.getAttribute('d')).not.toMatch(/z/i);
    });
  });

  it('uses a non-scaling stroke so width stays even under preserveAspectRatio="none"', () => {
    const svg = renderDivider();
    expect(svg).toHaveAttribute('preserveAspectRatio', 'none');
    svg.querySelectorAll('path').forEach((path) => {
      expect(path).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    });
  });

  it('is hidden from assistive tech and forwards the className', () => {
    const svg = renderDivider('opacity-50');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('opacity-50');
  });
});
