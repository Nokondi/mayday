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
  it('renders three stacked fill bands and no strokes', () => {
    const svg = renderDivider();
    const paths = Array.from(svg.querySelectorAll('path'));
    expect(paths).toHaveLength(3);
    paths.forEach((path) => {
      const cls = path.getAttribute('class') ?? '';
      expect(cls).toMatch(/\bfill-/);
      expect(cls).not.toMatch(/\bstroke-/);
    });
  });

  it('paints darkest at the back and lightest at the front so the bottom band matches the page background', () => {
    // SVG paints in document order, so the first path is the back of the
    // stack and the last is the front. The shades step from darker (the
    // band just below the header) to lighter (the band that meets the page
    // background below the divider).
    const svg = renderDivider();
    const shades = Array.from(svg.querySelectorAll('path')).map(
      (p) => p.getAttribute('class') ?? '',
    );
    expect(shades[0]).toContain('fill-mayday-200');
    expect(shades[1]).toContain('fill-mayday-100');
    expect(shades[2]).toContain('fill-mayday-50');
  });

  it('stretches edge-to-edge via preserveAspectRatio="none"', () => {
    const svg = renderDivider();
    expect(svg).toHaveAttribute('preserveAspectRatio', 'none');
  });

  it('is hidden from assistive tech and forwards the className', () => {
    const svg = renderDivider('opacity-50');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('opacity-50');
  });
});
