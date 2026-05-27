import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { logger } from '@/src/core/logger';
import type { DeepSeekAdapter } from '@/src/platform/deepseek/types';

import { ExportChatButton } from './ExportChatButton';

const ROOT_ID = 'dse-chat-export-root';
const log = logger.child('ChatExportController');

export class ChatExportController {
  private reactRoot: Root | null = null;
  private mountPoint: HTMLElement | null = null;

  constructor(private readonly adapter: DeepSeekAdapter) {}

  refresh(): void {
    if (!this.adapter.isConversationPage()) {
      this.destroy();
      return;
    }

    if (!this.mountPoint || !this.mountPoint.isConnected) {
      this.mountPoint = document.createElement('div');
      this.mountPoint.id = ROOT_ID;
      document.body.appendChild(this.mountPoint);
      this.reactRoot = createRoot(this.mountPoint);
      log.info('Chat export button mounted');
    }

    this.reactRoot?.render(
      <React.StrictMode>
        <ExportChatButton adapter={this.adapter} />
      </React.StrictMode>,
    );
  }

  destroy(): void {
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.mountPoint?.remove();
    this.mountPoint = null;
    log.info('Chat export button destroyed');
  }
}
