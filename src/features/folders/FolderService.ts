import { logger } from '@/src/core/logger';

import { FolderBackupService } from './FolderBackupService';
import { folderRepository, type FolderRepositoryPort } from './FolderRepository';
import { assertValidConversationInput, assertValidFolderData } from './folderValidation';
import type {
  ConversationInput,
  Folder,
  FolderBackup,
  FolderData,
  FolderExportPayload,
} from './types';

const log = logger.child('FolderService');

export class FolderService {
  private readonly repository: FolderRepositoryPort;
  private readonly backups: FolderBackupService;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    repository: FolderRepositoryPort = folderRepository,
    backups?: FolderBackupService,
  ) {
    this.repository = repository;
    this.backups = backups ?? new FolderBackupService(repository);
  }

  async getData(): Promise<FolderData> {
    return this.enqueue(() => this.repository.read());
  }

  async createFolder(name: string, parentId: string | null = null): Promise<FolderData> {
    return this.enqueue(() =>
      this.update('createFolder', (data) => {
        const normalizedName = requireName(name);
        if (parentId) {
          const parent = this.requireFolder(data, parentId);
          if (parent.parentId) throw new Error('Only two folder levels are supported');
        }

        const now = Date.now();
        data.folders.push({
          id: createUniqueId('folder', new Set(data.folders.map((folder) => folder.id))),
          name: normalizedName,
          parentId,
          order: data.folders.filter((folder) => folder.parentId === parentId).length,
          pinned: false,
          createdAt: now,
          updatedAt: now,
        });
        return true;
      }),
    );
  }

  async renameFolder(folderId: string, name: string): Promise<FolderData> {
    return this.enqueue(() =>
      this.update('renameFolder', (data) => {
        const folder = this.requireFolder(data, folderId);
        const normalizedName = requireName(name);
        if (folder.name === normalizedName) return false;
        folder.name = normalizedName;
        folder.updatedAt = Date.now();
        return true;
      }),
    );
  }

  async deleteFolder(folderId: string): Promise<FolderData> {
    return this.enqueue(() =>
      this.update('deleteFolder', (data) => {
        this.requireFolder(data, folderId);
        const deleted = new Set([folderId]);
        for (const folder of data.folders) {
          if (folder.parentId === folderId) deleted.add(folder.id);
        }
        data.folders = data.folders.filter((folder) => !deleted.has(folder.id));
        data.items = data.items.filter((item) => !deleted.has(item.folderId));
        return true;
      }),
    );
  }

  async addConversation(folderId: string, conversation: ConversationInput): Promise<FolderData> {
    return this.addConversations(folderId, [conversation]);
  }

  async addConversations(
    folderId: string,
    conversations: ConversationInput[],
  ): Promise<FolderData> {
    return this.enqueue(() =>
      this.update('addConversations', (data) => {
        this.requireFolder(data, folderId);
        const existing = new Set(
          data.items
            .filter((item) => item.folderId === folderId)
            .map((item) => item.conversationId),
        );
        const itemIds = new Set(data.items.map((item) => item.id));
        let changed = false;

        for (const conversation of conversations) {
          assertValidConversationInput(conversation);
          if (existing.has(conversation.id)) continue;
          existing.add(conversation.id);
          data.items.push({
            id: createUniqueId('item', itemIds),
            folderId,
            conversationId: conversation.id,
            title: conversation.title.trim() || '未命名对话',
            url: conversation.url,
            addedAt: Date.now(),
            order: data.items.filter((item) => item.folderId === folderId).length,
          });
          changed = true;
        }
        return changed;
      }),
    );
  }

  async removeConversation(itemId: string): Promise<FolderData> {
    return this.enqueue(() =>
      this.update('removeConversation', (data) => {
        if (!data.items.some((item) => item.id === itemId)) return false;
        data.items = data.items.filter((item) => item.id !== itemId);
        return true;
      }),
    );
  }

  async transferConversation(
    itemId: string,
    targetFolderId: string,
    action: 'move' | 'copy',
  ): Promise<FolderData> {
    return this.enqueue(() =>
      this.update(action === 'move' ? 'moveConversation' : 'copyConversation', (data) => {
        this.requireFolder(data, targetFolderId);
        const source = data.items.find((item) => item.id === itemId);
        if (!source) throw new Error(`Folder item not found: ${itemId}`);
        if (source.folderId === targetFolderId) return false;

        const existsInTarget = data.items.some(
          (item) =>
            item.folderId === targetFolderId && item.conversationId === source.conversationId,
        );
        if (!existsInTarget) {
          data.items.push({
            ...source,
            id: createUniqueId('item', new Set(data.items.map((item) => item.id))),
            folderId: targetFolderId,
            addedAt: Date.now(),
            order: data.items.filter((item) => item.folderId === targetFolderId).length,
          });
        }
        if (action === 'move') data.items = data.items.filter((item) => item.id !== itemId);
        return !existsInTarget || action === 'move';
      }),
    );
  }

  async importData(
    payload: FolderExportPayload,
    strategy: 'merge' | 'overwrite',
  ): Promise<FolderData> {
    return this.enqueue(async () => {
      assertValidFolderData(payload.data);
      const current = await this.repository.read();
      try {
        await this.backups.create('before-import', current);
      } catch (error) {
        log.warn('Before-import backup skipped', { error });
      }

      const next = structuredClone(strategy === 'overwrite' ? payload.data : current);
      const changed = strategy === 'overwrite' || mergeFolderData(next, payload.data);
      if (!changed) {
        log.debug('Folder merge import skipped; no changes');
        return current;
      }
      next.updatedAt = Date.now();
      assertValidFolderData(next);
      try {
        await this.repository.write(next);
      } catch (error) {
        if (isQuotaError(error)) {
          log.warn('Import write quota exceeded, pruning backups and retrying', { error });
          await this.pruneBackupsForQuota();
          await this.repository.write(next);
        } else {
          throw error;
        }
      }
      log.info('Folder data imported', {
        strategy,
        folderCount: next.folders.length,
        itemCount: next.items.length,
      });
      return next;
    });
  }

  async createManualBackup(): Promise<void> {
    return this.enqueue(async () => {
      await this.backups.create('manual', await this.repository.read());
    });
  }

  async listBackups(): Promise<FolderBackup[]> {
    return this.enqueue(() => this.backups.list());
  }

  async restoreBackup(backupId: string): Promise<FolderData> {
    return this.enqueue(() => this.backups.restore(backupId));
  }

  private async update(
    operation: string,
    mutate: (data: FolderData) => boolean | Promise<boolean>,
  ): Promise<FolderData> {
    const current = await this.repository.read();
    assertValidFolderData(current);
    const next = structuredClone(current);
    if (!(await mutate(next))) {
      log.debug('Folder data update skipped; no changes', { operation });
      return current;
    }

    next.updatedAt = Date.now();
    assertValidFolderData(next);
    try {
      await this.backups.create('before-write', current);
    } catch (error) {
      log.warn('Before-write backup skipped', { operation, error });
    }
    try {
      await this.repository.write(next);
    } catch (error) {
      if (isQuotaError(error)) {
        log.warn('Folder write quota exceeded, pruning backups and retrying', {
          operation,
          error,
        });
        try {
          await this.pruneBackupsForQuota();
          await this.repository.write(next);
        } catch (retryError) {
          log.warn('Folder write retry failed', { operation, error: retryError });
          throw retryError;
        }
      } else {
        throw error;
      }
    }
    log.info('Folder data updated', {
      operation,
      folderCount: next.folders.length,
      itemCount: next.items.length,
    });
    return next;
  }

  private async pruneBackupsForQuota(): Promise<void> {
    try {
      const backups = await this.repository.readBackups();
      if (backups.length === 0) return;
      const pruned = backups
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, Math.ceil(backups.length / 2));
      await this.repository.writeBackups(pruned);
    } catch (error) {
      log.warn('Prune backups for quota failed', { error });
    }
  }

  private requireFolder(data: FolderData, folderId: string): Folder {
    const folder = data.folders.find((candidate) => candidate.id === folderId);
    if (!folder) throw new Error(`Folder not found: ${folderId}`);
    return folder;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function mergeFolderData(target: FolderData, imported: FolderData): boolean {
  const foldersById = new Map(target.folders.map((folder) => [folder.id, folder]));
  const usedFolderIds = new Set(foldersById.keys());
  const mappedFolderIds = new Map<string, string>();
  let changed = false;

  const orderedFolders = [
    ...imported.folders.filter((folder) => folder.parentId === null),
    ...imported.folders.filter((folder) => folder.parentId !== null),
  ];
  for (const folder of orderedFolders) {
    let mappedParentId: string | null = null;
    if (folder.parentId) {
      const mappedParent = mappedFolderIds.get(folder.parentId);
      if (!mappedParent) {
        throw new Error(`Imported parent folder mapping is missing: ${folder.id}`);
      }
      mappedParentId = mappedParent;
    }
    const collision = foldersById.get(folder.id);
    if (collision && collision.name === folder.name && collision.parentId === mappedParentId) {
      mappedFolderIds.set(folder.id, collision.id);
      continue;
    }

    const id = collision ? createUniqueId('folder', usedFolderIds) : folder.id;
    usedFolderIds.add(id);
    mappedFolderIds.set(folder.id, id);
    const added = { ...folder, id, parentId: mappedParentId };
    target.folders.push(added);
    foldersById.set(id, added);
    changed = true;
  }

  const itemIds = new Set(target.items.map((item) => item.id));
  const itemKeys = new Set(
    target.items.map((item) => `${item.folderId}:${item.conversationId}`),
  );
  for (const item of imported.items) {
    const folderId = mappedFolderIds.get(item.folderId);
    if (!folderId) throw new Error(`Imported item folder mapping is missing: ${item.id}`);
    const key = `${folderId}:${item.conversationId}`;
    if (itemKeys.has(key)) continue;

    const id = itemIds.has(item.id) ? createUniqueId('item', itemIds) : item.id;
    itemIds.add(id);
    itemKeys.add(key);
    target.items.push({ ...item, id, folderId });
    changed = true;
  }
  return changed;
}

function createUniqueId(prefix: string, used: Set<string>): string {
  let id: string;
  do {
    const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
    id = `${prefix}_${random}`;
  } while (used.has(id));
  used.add(id);
  return id;
}

function requireName(name: string): string {
  const normalized = name.trim();
  if (!normalized) throw new Error('Folder name is required');
  return normalized;
}

function isQuotaError(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error);
  return message.toLowerCase().includes('quota');
}
