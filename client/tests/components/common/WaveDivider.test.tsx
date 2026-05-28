import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WaveDivider } from '../../../src/components/common/WaveDivider.js';

function renderDivider(className?: string) {
  const { container } = render(<WaveDivider className={className} />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('WaveDivider did not render an svg');
  return svg;
}

function strokePaths(svg: SVGSVGElement) {
  return Array.from(svg.querySelectorAll('path[class*="stroke-"]'));
}

function fillPaths(svg: SVGSVGElement) {
  return Array.from(svg.querySelectorAll('path[class*="fill-"]'));
}

describe('WaveDivider', () => {
  it('renders three stroke waves over a single filled base', () => {
    const svg = renderDivider();
    expect(svg.querySelectorAll('path')).toHaveLength(4);
    expect(strokePaths(svg)).toHaveLength(3);
    expect(fillPaths(svg)).toHaveLength(1);
  });

  it('draws the wave lines as open, non-scaling strokes with no fill', () => {
    const svg = renderDivider();
    // The svg defaults fill to none; the wave lines never opt back into a fill.
    expect(svg).toHaveAttribute('fill', 'none');
    strokePaths(svg).forEach((path) => {
      expect(path.getAttribute('class')).not.toMatch(/\bfill-/);
      // Open curves: no closepath command, so they read as lines, not shapes.
      expect(path.getAttribute('d')).not.toMatch(/z/i);
      expect(path).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    });
  });

  it('fills the area below the middle wave with mayday-50', () => {
    const svg = renderDivider();
    const fill = fillPaths(svg);
    expect(fill).toHaveLength(1);
    expect(fill[0].getAttribute('class')).toContain('fill-mayday-50');
    // Closed shape: a wave across the top, down to the bottom edge and back.
    expect(fill[0].getAttribute('d')).toMatch(/z$/i);
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
