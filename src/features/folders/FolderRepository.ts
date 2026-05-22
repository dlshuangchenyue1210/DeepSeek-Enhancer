import { logger } from '@/src/core/logger';
import { storageGet, storageSet } from '@/src/core/storage';

import { assertValidFolderData, createEmptyFolderData } from './folderValidation';
import type { FolderBackup, FolderData } from './types';

export const FOLDER_DATA_KEY = 'dse.folders.v1';
export const FOLDER_BACKUP_KEY = 'dse.folderBackups.v1';

const log = logger.child('FolderRepository');

export class FolderRepository {
  async read(): Promise<FolderData> {
    const data = await storageGet<FolderData>('local', FOLDER_DATA_KEY);
    if (!data) return createEmptyFolderData();

    try {
      assertValidFolderData(data);
      return data;
    } catch (error) {
      log.error('Stored folder data is invalid', { error });
      throw error;
    }
  }

  async write(data: FolderData): Promise<void> {
    assertValidFolderData(data);
    await storageSet('local', FOLDER_DATA_KEY, data);
  }

  async readBackups(): Promise<FolderBackup[]> {
    return (await storageGet<FolderBackup[]>('local', FOLDER_BACKUP_KEY)) ?? [];
  }

  async writeBackups(backups: FolderBackup[]): Promise<void> {
    await storageSet('local', FOLDER_BACKUP_KEY, backups);
  }
}

export const folderRepository = new FolderRepository();
