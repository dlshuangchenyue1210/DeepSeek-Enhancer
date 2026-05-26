import { logger } from '@/src/core/logger';

import { folderBackupService } from './FolderBackupService';
import { folderRepository } from './FolderRepository';
import { assertValidFolderData, createEmptyFolderData } from './folderValidation';
import type { ConversationInput, Folder, FolderData, FolderExportPayload } from './types';

const log = logger.child('FolderService');

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class FolderService {
  async getData(): Promise<FolderData> {
    return folderRepository.read();
  }

  async createFolder(name: string, parentId: string | null = null): Promise<FolderData> {
    return this.update('createFolder', (data) => {
      if (parentId) {
        const parent = data.folders.find((folder) => folder.id === parentId);
        if (!parent) throw new Error('Parent folder not found');
        if (parent.parentId) throw new Error('Only two folder levels are supported');
      }

      const now = Date.now();
      data.folders.push({
        id: createId('folder'),
        name: name.trim(),
        parentId,
        order: data.folders.filter((folder) => folder.parentId === parentId).length,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  async renameFolder(folderId: string, name: string): Promise<FolderData> {
    return this.update('renameFolder', (data) => {
      const folder = this.requireFolder(data, folderId);
      folder.name = name.trim();
      folder.updatedAt = Date.now();
    });
  }

  async deleteFolder(folderId: string): Promise<FolderData> {
    return this.update('deleteFolder', (data) => {
      const deleted = new Set([folderId]);
      for (const folder of data.folders) {
        if (folder.parentId === folderId) deleted.add(folder.id);
      }
      data.folders = data.folders.filter((folder) => !deleted.has(folder.id));
      data.items = data.items.filter((item) => !deleted.has(item.folderId));
    });
  }

  async addConversation(folderId: string, conversation: ConversationInput): Promise<FolderData> {
    return this.update('addConversation', (data) => {
      this.requireFolder(data, folderId);
      const exists = data.items.some(
        (item) => item.folderId === folderId && item.conversationId === conversation.id,
      );
      if (exists) return;

      data.items.push({
        id: createId('item'),
        folderId,
        conversationId: conversation.id,
        title: conversation.title.trim() || '未命名对话',
        url: conversation.url,
        addedAt: Date.now(),
        order: data.items.filter((item) => item.folderId === folderId).length,
      });
    });
  }

  async removeConversation(itemId: string): Promise<FolderData> {
    return this.update('removeConversation', (data) => {
      data.items = data.items.filter((item) => item.id !== itemId);
    });
  }

  async transferConversation(
    itemId: string,
    targetFolderId: string,
    action: 'move' | 'copy',
  ): Promise<FolderData> {
    return this.update(action === 'move' ? 'moveConversation' : 'copyConversation', (data) => {
      this.requireFolder(data, targetFolderId);
      const source = data.items.find((item) => item.id === itemId);
      if (!source) throw new Error(`Folder item not found: ${itemId}`);
      if (source.folderId === targetFolderId) return;

      const existsInTarget = data.items.some(
        (item) =>
          item.folderId === targetFolderId && item.conversationId === source.conversationId,
      );

      if (!existsInTarget) {
        data.items.push({
          id: createId('item'),
          folderId: targetFolderId,
          conversationId: source.conversationId,
          title: source.title,
          url: source.url,
          addedAt: Date.now(),
          order: data.items.filter((item) => item.folderId === targetFolderId).length,
        });
      }

      if (action === 'move') {
        data.items = data.items.filter((item) => item.id !== itemId);
      }
    });
  }

  async importData(
    payload: FolderExportPayload,
    strategy: 'merge' | 'overwrite',
  ): Promise<FolderData> {
    const current = await folderRepository.read();
    await folderBackupService.create('before-import', current);

    if (strategy === 'overwrite') {
      await folderRepository.write({ ...payload.data, updatedAt: Date.now() });
      log.info('Folder data imported with overwrite', {
        folderCount: payload.data.folders.length,
        itemCount: payload.data.items.length,
      });
      return payload.data;
    }

    return this.update('importMerge', (data) => {
      const folderIds = new Set(data.folders.map((folder) => folder.id));
      const itemKeys = new Set(data.items.map((item) => `${item.folderId}:${item.conversationId}`));

      for (const folder of payload.data.folders) {
        if (!folderIds.has(folder.id)) data.folders.push(folder);
      }

      for (const item of payload.data.items) {
        const key = `${item.folderId}:${item.conversationId}`;
        if (!itemKeys.has(key)) data.items.push(item);
      }
    });
  }

  async createManualBackup(): Promise<void> {
    await folderBackupService.create('manual', await folderRepository.read());
  }

  private async update(
    operation: string,
    mutate: (data: FolderData) => void | Promise<void>,
  ): Promise<FolderData> {
    const current = await folderRepository.read().catch(() => createEmptyFolderData());
    assertValidFolderData(current);
    await folderBackupService.create('before-write', current);

    const next: FolderData = structuredClone(current);
    await mutate(next);
    next.updatedAt = Date.now();
    assertValidFolderData(next);

    await folderRepository.write(next);
    log.info('Folder data updated', {
      operation,
      folderCount: next.folders.length,
      itemCount: next.items.length,
    });
    return next;
  }

  private requireFolder(data: FolderData, folderId: string): Folder {
    const folder = data.folders.find((candidate) => candidate.id === folderId);
    if (!folder) throw new Error(`Folder not found: ${folderId}`);
    return folder;
  }
}

export const folderService = new FolderService();
