/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          [
            'formatjs',
            {
              idInterpolationPattern: '[sha512:contenthash:base64:6]',
              ast: true,
            },
          ],
        ],
      },
    }),
    svgr(),
  ],
  resolve: {
    alias: {
      '@mayday/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
      // The package's ESM build (modules-esm/libsodium-wrappers.mjs) imports
      // a sibling file './libsodium.mjs' that the published tarball doesn't
      // contain — Rollup fails to resolve it during `vite build`, and Node's
      // ESM resolver (vitest) errors for the same reason. Point at the CJS
      // build instead; Vite's CommonJS interop handles default-import.
      'libsodium-wrappers': path.resolve(
        __dirname,
        '../node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js',
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: false,
  },
});
