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
  private conversationKey: string | null = null;

  constructor(private readonly adapter: DeepSeekAdapter) {}

  mount(): void {
    const mountPoint = this.adapter.getSidebarMountPoint();
    if (!mountPoint) {
      log.warn('Embedded folder UI skipped; mount point unavailable');
      return;
    }

    mountPoint.classList.add('dse-embedded-folder-root');
    if (this.reactRoot && this.mountPoint !== mountPoint) {
      this.unmountCurrentRoot();
    }
    this.mountPoint = mountPoint;

    if (!this.reactRoot) this.reactRoot = createRoot(mountPoint);
    if (!this.dragCleanup) this.dragCleanup = this.adapter.enableSidebarConversationDragging();

    this.renderIfChanged();

    log.info('Embedded folder UI mounted');
  }

  private renderIfChanged(): void {
    if (!this.reactRoot) return;
    const conversation = this.adapter.getCurrentConversation();
    const conversationKey = conversation
      ? `${conversation.id}\u0000${conversation.title}\u0000${conversation.url}`
      : '';
    if (this.conversationKey === conversationKey) return;
    this.conversationKey = conversationKey;
    this.reactRoot.render(
      <React.StrictMode>
        <FolderPanel
          mode="embedded"
          currentConversation={conversation}
          onOpenConversation={(conversation) => this.adapter.openConversation(conversation)}
        />
      </React.StrictMode>,
    );
  }

  refresh(): void {
    if (!this.reactRoot || !this.mountPoint || !this.mountPoint.isConnected) {
      if (this.mountPoint && !this.mountPoint.isConnected) {
        this.unmountCurrentRoot();
        this.mountPoint = null;
      }
      this.mount();
      return;
    }

    this.renderIfChanged();
  }

  destroy(): void {
    this.unmountCurrentRoot();
    this.mountPoint?.remove();
    this.mountPoint = null;
    log.info('Embedded folder UI destroyed');
  }

  private unmountCurrentRoot(): void {
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.conversationKey = null;
    this.dragCleanup?.();
    this.dragCleanup = null;
  }
}
