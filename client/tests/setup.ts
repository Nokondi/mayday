import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// findBy*/waitFor default to 1s, which a cold first render (jsdom warmup +
// the first getByRole) nearly exhausts on its own. Under full-suite load that
// tips into timeouts. Passing waits still resolve as soon as they match.
configure({ asyncUtilTimeout: 5000 });

// Unmount React trees and clean up DOM between tests
afterEach(() => {
  cleanup();
});
