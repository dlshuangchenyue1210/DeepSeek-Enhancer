import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'DeepSeek Enhancer',
    description: 'Enhance DeepSeek Chat with folder management.',
    permissions: ['storage', 'tabs'],
    host_permissions: ['https://chat.deepseek.com/*'],
    action: {
      default_title: 'DeepSeek Enhancer',
    },
  },
  vite: () => ({
    plugins: [react(), tailwindcss()],
  }),
});
