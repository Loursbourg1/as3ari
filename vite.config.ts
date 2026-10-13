/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const geminiApiKey = (
    process.env.Gemini ||
    process.env.GEMINI ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    env.Gemini ||
    env.GEMINI ||
    env.VITE_GEMINI_API_KEY ||
    env.GEMINI_API_KEY ||
    ''
  ).trim();

  return {
    plugins: [react(), tailwindcss()],
    define: {
      '__GEMINI_API_KEY__': JSON.stringify(geminiApiKey),
      'import.meta.env.Gemini': JSON.stringify(geminiApiKey),
      'import.meta.env.GEMINI': JSON.stringify(geminiApiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiApiKey),
    },
    server: {
      host: true,
      port: 5173,
    },
    envPrefix: ['VITE_', 'RECAPTCHA_', 'DEMO_', 'SUPABASE_', 'Gemini', 'GEMINI'],
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
  };
});
