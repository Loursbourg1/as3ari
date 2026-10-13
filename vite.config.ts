/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
      {
        test: {
          name: 'db',
          include: ['tests/db/**/*.test.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
