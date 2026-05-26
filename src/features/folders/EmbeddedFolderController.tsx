import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { logger } from '@/src/core/logger';
import type { DeepSeekAdapter } from '@/src/platform/deepseek/types';

import { FolderPanel } from './FolderPanel';

const log = logger.child('EmbeddedFolders');

export class EmbeddedFolderController {
  private reactRoot: Root | null = null;
  private mountPoint: HTMLElement | null = null;
  private dragCleanup: (() => void) | null = null;

  constructor(private readonly adapter: DeepSeekAdapter) {}

  mount(): void {
    if (!this.adapter.isConversationPage()) {
      this.destroy();
      return;
    }

    const mountPoint = this.adapter.getSidebarMountPoint();
    if (!mountPoint) {
      log.warn('Embedded folder UI skipped; mount point unavailable');
      return;
    }

    mountPoint.classList.add('dse-embedded-folder-root');
    if (this.reactRoot && this.mountPoint !== mountPoint) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
    this.mountPoint = mountPoint;

    if (!this.reactRoot) this.reactRoot = createRoot(mountPoint);
    if (!this.dragCleanup) this.dragCleanup = this.adapter.enableSidebarConversationDragging();

    this.reactRoot.render(
      <React.StrictMode>
        <FolderPanel
          mode="embedded"
          currentConversation={this.adapter.getCurrentConversation()}
          onOpenConversation={(conversation) => this.adapter.openConversation(conversation)}
        />
      </React.StrictMode>,
    );

    log.info('Embedded folder UI mounted');
  }

  refresh(): void {
    if (!this.adapter.isConversationPage()) {
      this.destroy();
      return;
    }

    if (!this.reactRoot || !this.mountPoint || !this.mountPoint.isConnected) {
      if (this.mountPoint && !this.mountPoint.isConnected) {
        this.reactRoot?.unmount();
        this.reactRoot = null;
        this.mountPoint = null;
      }
      this.mount();
      return;
    }

    this.reactRoot.render(
      <React.StrictMode>
        <FolderPanel
          mode="embedded"
          currentConversation={this.adapter.getCurrentConversation()}
          onOpenConversation={(conversation) => this.adapter.openConversation(conversation)}
        />
      </React.StrictMode>,
    );
  }

  destroy(): void {
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.dragCleanup?.();
    this.dragCleanup = null;
    this.mountPoint?.remove();
    this.mountPoint = null;
    log.info('Embedded folder UI destroyed');
  }
}
