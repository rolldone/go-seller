// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";

import react from '@astrojs/react';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // ⚡ Tambahkan baris ini untuk mengaktifkan SSR
  output: 'server', 

  integrations: [react()],

  vite: {
    server: { host: '0.0.0.0' },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
    },
    plugins: /** @type {any} */ ([tailwindcss()]),
  },

  adapter: node({
    mode: 'standalone',
  }),
});
