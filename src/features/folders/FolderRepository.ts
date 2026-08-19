import { logger } from '@/src/core/logger';
import { storageGet, storageSet } from '@/src/core/storage';

import { assertValidFolderData, createEmptyFolderData } from './folderValidation';
import type { FolderBackup, FolderData, FolderRecoverySnapshot } from './types';

export const FOLDER_DATA_KEY = 'dse.folders.v1';
export const FOLDER_BACKUP_KEY = 'dse.folderBackups.v1';
export const FOLDER_RECOVERY_KEY = 'dse.folderRecovery.v1';

const log = logger.child('FolderRepository');

export class FolderRepository {
  async read(): Promise<FolderData> {
    const data = await this.readRaw();
    if (data === undefined) return createEmptyFolderData();

    try {
      assertValidFolderData(data);
      return data;
    } catch (error) {
      log.error('Stored folder data is invalid', { error });
      throw error;
    }
  }

  async readRaw(): Promise<unknown> {
    return storageGet<unknown>('local', FOLDER_DATA_KEY);
  }

  async write(data: FolderData): Promise<void> {
    assertValidFolderData(data);
    await storageSet('local', FOLDER_DATA_KEY, data);
  }

  async readBackups(): Promise<FolderBackup[]> {
    const backups = await storageGet<unknown>('local', FOLDER_BACKUP_KEY);
    if (backups === undefined) return [];
    if (!Array.isArray(backups)) throw new Error('Stored folder backups must be an array');

    for (const backup of backups) assertValidBackup(backup);
    return backups;
  }

  async writeBackups(backups: FolderBackup[]): Promise<void> {
    for (const backup of backups) assertValidBackup(backup);
    await storageSet('local', FOLDER_BACKUP_KEY, backups);
  }

  async preserveInvalidData(data: unknown): Promise<FolderRecoverySnapshot> {
    let cloned: unknown;
    try {
      cloned = structuredClone(data);
    } catch {
      try {
        cloned = JSON.parse(JSON.stringify(data));
      } catch {
        cloned = String(data).slice(0, 2000);
      }
    }
    const snapshot: FolderRecoverySnapshot = {
      createdAt: Date.now(),
      reason: 'invalid-main-before-restore',
      data: cloned,
    };
    const current = await storageGet<unknown>('local', FOLDER_RECOVERY_KEY);
    if (current !== undefined && !Array.isArray(current)) {
      throw new Error('Stored folder recovery snapshots must be an array');
    }
    const snapshots = [snapshot, ...((current as FolderRecoverySnapshot[] | undefined) ?? [])].slice(
      0,
      3,
    );
    await storageSet('local', FOLDER_RECOVERY_KEY, snapshots);
    log.warn('Invalid folder data preserved before recovery', { createdAt: snapshot.createdAt });
    return snapshot;
  }
}

export type FolderRepositoryPort = Pick<
  FolderRepository,
  'read' | 'readRaw' | 'write' | 'readBackups' | 'writeBackups' | 'preserveInvalidData'
>;

function assertValidBackup(input: unknown): asserts input is FolderBackup {
  if (!input || typeof input !== 'object') throw new Error('Invalid folder backup');
  const backup = input as Partial<FolderBackup>;
  if (!backup.id || typeof backup.id !== 'string') throw new Error('Invalid folder backup id');
  if (typeof backup.createdAt !== 'number' || !Number.isFinite(backup.createdAt)) {
    throw new Error(`Invalid folder backup timestamp: ${backup.id}`);
  }
  if (!['before-write', 'before-import', 'manual'].includes(String(backup.reason))) {
    throw new Error(`Invalid folder backup reason: ${backup.id}`);
  }
  assertValidFolderData(backup.data);
}

export const folderRepository = new FolderRepository();
