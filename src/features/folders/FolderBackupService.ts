import { logger } from '@/src/core/logger';

import { folderRepository } from './FolderRepository';
import type { FolderBackup, FolderBackupReason, FolderData } from './types';

const log = logger.child('FolderBackupService');

const LIMITS: Record<FolderBackupReason, number> = {
  'before-write': 20,
  'before-import': 10,
  manual: 20,
};

function createId(): string {
  return `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function prune(backups: FolderBackup[]): FolderBackup[] {
  const result: FolderBackup[] = [];

  for (const reason of Object.keys(LIMITS) as FolderBackupReason[]) {
    const limit = LIMITS[reason];
    result.push(
      ...backups
        .filter((backup) => backup.reason === reason)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit),
    );
  }

  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export class FolderBackupService {
  async create(reason: FolderBackupReason, data: FolderData): Promise<FolderBackup> {
    const backup: FolderBackup = {
      id: createId(),
      createdAt: Date.now(),
      reason,
      data,
    };

    const backups = prune([backup, ...(await folderRepository.readBackups())]);
    await folderRepository.writeBackups(backups);
    log.info('Folder backup created', { reason, backupId: backup.id });
    return backup;
  }

  async list(): Promise<FolderBackup[]> {
    return folderRepository.readBackups();
  }

  async restore(backupId: string): Promise<FolderData> {
    const backups = await folderRepository.readBackups();
    const backup = backups.find((item) => item.id === backupId);
    if (!backup) throw new Error(`Backup not found: ${backupId}`);

    await this.create('before-write', await folderRepository.read());
    await folderRepository.write(backup.data);
    log.info('Folder backup restored', { backupId });
    return backup.data;
  }
}

export const folderBackupService = new FolderBackupService();
