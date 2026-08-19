import { logger } from '@/src/core/logger';

import { folderRepository, type FolderRepositoryPort } from './FolderRepository';
import { assertValidFolderData } from './folderValidation';
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

function pruneWithLimits(
  backups: FolderBackup[],
  limits: Record<FolderBackupReason, number>,
): FolderBackup[] {
  const result: FolderBackup[] = [];
  for (const reason of Object.keys(limits) as FolderBackupReason[]) {
    const limit = limits[reason];
    result.push(
      ...backups
        .filter((backup) => backup.reason === reason)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit),
    );
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

function isQuotaError(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error);
  return message.toLowerCase().includes('quota');
}

export class FolderBackupService {
  constructor(private readonly repository: FolderRepositoryPort = folderRepository) {}

  async create(reason: FolderBackupReason, data: FolderData): Promise<FolderBackup> {
    const backup: FolderBackup = {
      id: createId(),
      createdAt: Date.now(),
      reason,
      data: structuredClone(data),
    };

    let existing: FolderBackup[] = [];
    try {
      existing = await this.repository.readBackups();
    } catch (error) {
      const preview = String((error as Error)?.message ?? error).slice(0, 500);
      log.warn('Folder backups corrupted, resetting', { reason, error: preview });
      existing = [];
    }

    const backups = prune([backup, ...existing]);
    try {
      await this.repository.writeBackups(backups);
    } catch (error) {
      if (isQuotaError(error)) {
        log.warn('Folder backup quota exceeded, pruning and retrying', { reason, error });
        const halved = pruneWithLimits([backup, ...existing], {
          'before-write': Math.ceil(LIMITS['before-write'] / 2),
          'before-import': Math.ceil(LIMITS['before-import'] / 2),
          manual: Math.ceil(LIMITS.manual / 2),
        });
        try {
          await this.repository.writeBackups(halved);
        } catch (retryError) {
          log.warn('Folder backup retry failed, continuing without backup', {
            reason,
            error: retryError,
          });
        }
      } else {
        log.warn('Folder backup write failed, continuing without backup', { reason, error });
      }
    }
    log.info('Folder backup created', { reason, backupId: backup.id });
    return backup;
  }

  async list(): Promise<FolderBackup[]> {
    return this.repository.readBackups();
  }

  async restore(backupId: string): Promise<FolderData> {
    const backups = await this.repository.readBackups();
    const backup = backups.find((item) => item.id === backupId);
    if (!backup) throw new Error(`Backup not found: ${backupId}`);

    const current = await this.repository.readRaw();
    if (current !== undefined) {
      try {
        assertValidFolderData(current);
        await this.create('before-write', current);
      } catch (error) {
        await this.repository.preserveInvalidData(current);
        log.warn('Invalid current folder data preserved before backup restore', { error });
      }
    }
    await this.repository.write(structuredClone(backup.data));
    log.info('Folder backup restored', { backupId });
    return backup.data;
  }
}
