import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://my-rfp-timeline.local',
  integrations: [preact({ compat: false })],
  vite: {
    plugins: [tailwindcss()],
  },
  output: 'static',
});
