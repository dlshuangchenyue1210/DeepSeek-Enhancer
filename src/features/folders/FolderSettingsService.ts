import { storageGet, storageSet } from '@/src/core/storage';

export const SETTINGS_KEY = 'dse.settings';

export type FolderItemDropAction = 'move' | 'copy';

export type FolderSettings = {
  folderItemDropAction: FolderItemDropAction;
};

const DEFAULT_SETTINGS: FolderSettings = {
  folderItemDropAction: 'move',
};

export async function getFolderSettings(): Promise<FolderSettings> {
  const stored = await storageGet<Partial<FolderSettings>>('sync', SETTINGS_KEY);
  return normalizeFolderSettings(stored);
}

export async function updateFolderSettings(update: Partial<FolderSettings>): Promise<FolderSettings> {
  const current = await getFolderSettings();
  const next = normalizeFolderSettings({ ...current, ...update });
  await storageSet('sync', SETTINGS_KEY, next);
  return next;
}

export function normalizeFolderSettings(input: Partial<FolderSettings> | undefined): FolderSettings {
  return {
    folderItemDropAction:
      input?.folderItemDropAction === 'copy' || input?.folderItemDropAction === 'move'
        ? input.folderItemDropAction
        : DEFAULT_SETTINGS.folderItemDropAction,
  };
}
