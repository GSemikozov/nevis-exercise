import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { FontaineTransform } from 'fontaine';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const API_PORT = Number(process.env.API_PORT ?? 3001);

/*
 * Vite's counterpart to next/font, in three parts:
 * 1. Fontsource self-hosts Inter; Vite fingerprints the files for immutable caching.
 * 2. fontaine adds a metric-matched local fallback ("Inter fallback"), so swapping
 *    to Inter does not shift layout.
 * 3. preloadFont() preloads the one file the first paint needs (latin, 400).
 */
function preloadFont(pattern: RegExp): Plugin {
  return {
    name: 'preload-font',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        const font = Object.keys(bundle ?? {}).find((file) => pattern.test(file));
        if (!font) throw new Error(`preload-font: no emitted file matches ${pattern}`);
        return [
          {
            tag: 'link',
            attrs: {
              rel: 'preload',
              href: `/${font}`,
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
            },
            injectTo: 'head',
          },
        ];
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    FontaineTransform.vite({
      fallbacks: ['Arial', 'Helvetica Neue', 'Segoe UI'],
      resolvePath: (id) =>
        new URL(id, new URL('./node_modules/@fontsource/inter/', import.meta.url)),
    }),
    preloadFont(/inter-latin-400-normal-[\w-]+\.woff2$/),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@shared': path.resolve(import.meta.dirname, './shared'),
    },
  },
  server: {
    port: 3000,
    // The REST API runs as a separate Node process in dev (`npm run dev:api`).
    proxy: { '/api': `http://localhost:${API_PORT}` },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          css: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
        },
      },
    ],
  },
});
