import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'DeepSeek Enhancer',
    description: 'Enhance DeepSeek Chat with folder management, chat export, and formula copy.',
    permissions: ['storage'],
    host_permissions: ['https://chat.deepseek.com/*'],
    action: {
      default_title: 'DeepSeek Enhancer',
    },
    web_accessible_resources: [
      {
        resources: ['formula-renderer.html'],
        matches: ['https://chat.deepseek.com/*'],
      },
    ],
  },
  vite: () => ({
    plugins: [react(), tailwindcss()],
  }),
});
