import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/diagnostics.js', () => ({
  reportClientError: vi.fn(),
}));

import { RootErrorBoundary } from '../../../src/components/common/RootErrorBoundary.js';
import { reportClientError } from '../../../src/utils/diagnostics.js';

const mockedReport = vi.mocked(reportClientError);

function Boom(): React.ReactElement {
  throw new Error('kaboom');
}

describe('RootErrorBoundary', () => {
  // React logs caught errors to console.error; silence it so the test output
  // isn't noisy.
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <RootErrorBoundary>
        <p>all good</p>
      </RootErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('renders a recovery UI with a Reload button when a child throws', () => {
    render(
      <RootErrorBoundary>
        <Boom />
      </RootErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('beacons the error for diagnostics', () => {
    render(
      <RootErrorBoundary>
        <Boom />
      </RootErrorBoundary>,
    );
    expect(mockedReport).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'react-error-boundary',
        detail: expect.stringContaining('kaboom'),
      }),
    );
  });
});
