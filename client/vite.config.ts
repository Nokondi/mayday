/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import svgr from 'vite-plugin-svgr';

// @vitejs/plugin-react v6 transforms JSX with oxc and no longer accepts a
// `babel` option, so babel-plugin-formatjs (which pre-compiles inline
// `defineMessage`/`<FormattedMessage>` to AST and injects ids) is run as a
// standalone Babel pass via @rolldown/plugin-babel. It must run BEFORE
// react() so formatjs sees the original JSX before oxc lowers it. The plugin
// is async, so the config is an async factory.
export default defineConfig(async () => ({
  plugins: [
    await babel({
      plugins: [
        [
          'formatjs',
          {
            ast: true,
          },
        ],
      ],
    }),
    react(),
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
}));
