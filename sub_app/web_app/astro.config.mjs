// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import react from '@astrojs/react';
import node from '@astrojs/node';
import { loadEnv } from 'vite';

const mode = process.env.NODE_ENV ?? "development";
const env = loadEnv(mode, process.cwd(), "");

/**
 * @param {string} value
 * @returns {string}
 */
function extractHostname(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

/**
 * @param {string[]} hosts
 * @returns {string[]}
 */
function uniqueHosts(hosts) {
  return [...new Set(hosts.filter(Boolean))];
}

const allowedHosts = uniqueHosts([
  extractHostname(env.PUBLIC_APP_URL),
  extractHostname(env.PUBLIC_API_URL),
  "stage.umahstore.com",
]);

export default defineConfig({
  output: 'server',
  integrations: [react()],
  vite: {
    server: {
      host: '0.0.0.0',
      allowedHosts,
    },
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
    },
    plugins: /** @type {any} */ ([tailwindcss()]),
  },

  adapter: node({
    mode: 'standalone',
  }),
});
