import { describe, expect, it } from 'vitest';

import { FolderService } from './FolderService';
import { assertValidFolderData, createEmptyFolderData } from './folderValidation';
import type {
  FolderBackup,
  FolderData,
  FolderExportPayload,
  FolderRecoverySnapshot,
} from './types';

describe('FolderService', () => {
  it('fails closed without overwriting unreadable main data', async () => {
    const repository = new MemoryFolderRepository({ invalid: true });
    const service = new FolderService(repository);

    await expect(service.createFolder('New folder')).rejects.toThrow('Invalid folder data');
    expect(repository.writeCount).toBe(0);
    expect(repository.backups).toEqual([]);
  });

  it('serializes concurrent mutations so neither write is lost', async () => {
    const repository = new MemoryFolderRepository(createEmptyFolderData(), 5);
    const service = new FolderService(repository);

    await Promise.all([service.createFolder('First'), service.createFolder('Second')]);

    expect((await repository.read()).folders.map((folder) => folder.name)).toEqual([
      'First',
      'Second',
    ]);
    expect(repository.writeCount).toBe(2);
  });

  it('adds a batch with one write and skips a repeated no-op batch', async () => {
    const repository = new MemoryFolderRepository(dataWithRoot());
    const service = new FolderService(repository);
    const conversations = [conversation('a'), conversation('b')];

    await service.addConversations('root', conversations);
    expect(repository.writeCount).toBe(1);
    expect(repository.backups).toHaveLength(1);

    await service.addConversations('root', conversations);
    expect(repository.writeCount).toBe(1);
    expect(repository.backups).toHaveLength(1);
  });

  it('remaps conflicting folder and item ids during merge import', async () => {
    const current = dataWithRoot('Local');
    current.items.push({
      id: 'shared-item',
      folderId: 'root',
      conversationId: 'local-conversation',
      title: 'Local conversation',
      url: 'https://chat.deepseek.com/a/chat/s/local-conversation',
      addedAt: 1,
      order: 0,
    });
    const repository = new MemoryFolderRepository(current);
    const service = new FolderService(repository);
    const payload = exportPayload({
      folders: [{ ...dataWithRoot('Imported').folders[0]! }],
      items: [
        {
          id: 'shared-item',
          folderId: 'root',
          conversationId: 'imported-conversation',
          title: 'Imported conversation',
          url: 'https://chat.deepseek.com/a/chat/s/imported-conversation',
          addedAt: 2,
          order: 0,
        },
      ],
      updatedAt: 2,
    });

    const result = await service.importData(payload, 'merge');
    const importedFolder = result.folders.find((folder) => folder.name === 'Imported');
    const importedItem = result.items.find(
      (item) => item.conversationId === 'imported-conversation',
    );

    expect(importedFolder?.id).not.toBe('root');
    expect(importedItem?.folderId).toBe(importedFolder?.id);
    expect(importedItem?.id).not.toBe('shared-item');
    expect(repository.backups.map((backup) => backup.reason)).toEqual(['before-import']);
    expect(() => assertValidFolderData(result)).not.toThrow();
  });

  it('preserves invalid main data before restoring a valid backup', async () => {
    const repository = new MemoryFolderRepository({ invalid: true });
    repository.backups = [
      {
        id: 'backup-1',
        createdAt: 1,
        reason: 'manual',
        data: dataWithRoot('Recovered'),
      },
    ];
    const service = new FolderService(repository);

    const restored = await service.restoreBackup('backup-1');

    expect(restored.folders[0]?.name).toBe('Recovered');
    expect(repository.recoverySnapshots).toHaveLength(1);
    expect(repository.recoverySnapshots[0]?.data).toEqual({ invalid: true });
    expect((await repository.read()).folders[0]?.name).toBe('Recovered');
  });

  it('does not write when a merge import contains no new data', async () => {
    const current = dataWithRoot();
    const repository = new MemoryFolderRepository(current);
    const service = new FolderService(repository);

    const result = await service.importData(exportPayload(structuredClone(current)), 'merge');

    expect(result).toEqual(current);
    expect(repository.writeCount).toBe(0);
    expect(repository.backups.map((backup) => backup.reason)).toEqual(['before-import']);
  });
});

class MemoryFolderRepository {
  backups: FolderBackup[] = [];
  recoverySnapshots: FolderRecoverySnapshot[] = [];
  writeCount = 0;

  constructor(
    private data: unknown,
    private readonly readDelayMs = 0,
  ) {}

  async read(): Promise<FolderData> {
    if (this.readDelayMs) await new Promise((resolve) => setTimeout(resolve, this.readDelayMs));
    assertValidFolderData(this.data);
    return structuredClone(this.data);
  }

  async readRaw(): Promise<unknown> {
    return structuredClone(this.data);
  }

  async write(data: FolderData): Promise<void> {
    assertValidFolderData(data);
    this.data = structuredClone(data);
    this.writeCount += 1;
  }

  async readBackups(): Promise<FolderBackup[]> {
    return structuredClone(this.backups);
  }

  async writeBackups(backups: FolderBackup[]): Promise<void> {
    this.backups = structuredClone(backups);
  }

  async preserveInvalidData(data: unknown): Promise<FolderRecoverySnapshot> {
    const snapshot: FolderRecoverySnapshot = {
      createdAt: Date.now(),
      reason: 'invalid-main-before-restore',
      data: structuredClone(data),
    };
    this.recoverySnapshots.unshift(snapshot);
    return snapshot;
  }
}

function dataWithRoot(name = 'Root'): FolderData {
  return {
    folders: [
      {
        id: 'root',
        name,
        parentId: null,
        order: 0,
        pinned: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    items: [],
    updatedAt: 1,
  };
}

function conversation(id: string) {
  return {
    id,
    title: `Conversation ${id}`,
    url: `https://chat.deepseek.com/a/chat/s/${id}`,
  };
}

function exportPayload(data: FolderData): FolderExportPayload {
  return {
    format: 'deepseek-enhancer.folders.v1',
    version: '0.1.0',
    exportedAt: new Date(0).toISOString(),
    data,
  };
}
