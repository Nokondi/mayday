// libsodium-wrappers loads asynchronously (WASM) and its package.json points
// ESM consumers at a .mjs file that re-imports its `libsodium` sibling using
// a broken extensionless path. The browser/Vite handle this fine but Node's
// ESM resolver (used by vitest) blows up. Loading the module dynamically
// means tests that don't call into crypto never trigger the resolution chain.
//
// Every entry point that uses a sodium primitive must `await getSodium()` first.
type Sodium = typeof import('libsodium-wrappers');

let readyPromise: Promise<Sodium> | null = null;

export function getSodium(): Promise<Sodium> {
  if (!readyPromise) {
    readyPromise = import('libsodium-wrappers').then(async (mod) => {
      const s = mod.default ?? mod;
      await s.ready;
      return s as Sodium;
    });
  }
  return readyPromise;
}
