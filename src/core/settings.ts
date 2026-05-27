import { storageGet, storageSet } from './storage';

export const SETTINGS_KEY = 'dse.settings';

export type FolderItemDropAction = 'move' | 'copy';
export type FormulaCopyFormat = 'dollar' | 'native';

export type AppSettings = {
  folderItemDropAction: FolderItemDropAction;
  formulaCopyFormat: FormulaCopyFormat;
};

const DEFAULT_SETTINGS: AppSettings = {
  folderItemDropAction: 'move',
  formulaCopyFormat: 'dollar',
};

export async function getSettings(): Promise<AppSettings> {
  const stored = await storageGet<Partial<AppSettings>>('sync', SETTINGS_KEY);
  return normalizeSettings(stored);
}

export async function updateSettings(update: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = normalizeSettings({ ...current, ...update });
  await storageSet('sync', SETTINGS_KEY, next);
  return next;
}

export function normalizeSettings(input: Partial<AppSettings> | undefined): AppSettings {
  return {
    folderItemDropAction:
      input?.folderItemDropAction === 'copy' || input?.folderItemDropAction === 'move'
        ? input.folderItemDropAction
        : DEFAULT_SETTINGS.folderItemDropAction,
    formulaCopyFormat:
      input?.formulaCopyFormat === 'native' || input?.formulaCopyFormat === 'dollar'
        ? input.formulaCopyFormat
        : DEFAULT_SETTINGS.formulaCopyFormat,
  };
}
