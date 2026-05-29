import { storageGet, storageSet } from './storage';

export const SETTINGS_KEY = 'dse.settings';

export type FolderItemDropAction = 'move' | 'copy';
export type FormulaCopyFormat = 'dollar' | 'native';
export type FormulaClickAction =
  | 'copy-tex-dollar'
  | 'copy-tex-native'
  | 'copy-tex-source'
  | 'copy-mathml'
  | 'copy-svg'
  | 'copy-png'
  | 'copy-jpg'
  | 'download-svg'
  | 'download-png'
  | 'download-jpg';
export type ChatExportButtonPosition = {
  top: number;
  right: number;
};

export type AppSettings = {
  folderItemDropAction: FolderItemDropAction;
  formulaCopyFormat: FormulaCopyFormat;
  formulaDefaultAction: FormulaClickAction;
  chatExportButtonPosition: ChatExportButtonPosition | null;
};

const DEFAULT_SETTINGS: AppSettings = {
  folderItemDropAction: 'move',
  formulaCopyFormat: 'dollar',
  formulaDefaultAction: 'copy-tex-dollar',
  chatExportButtonPosition: null,
};

const FORMULA_CLICK_ACTIONS = new Set<FormulaClickAction>([
  'copy-tex-dollar',
  'copy-tex-native',
  'copy-tex-source',
  'copy-mathml',
  'copy-svg',
  'copy-png',
  'copy-jpg',
  'download-svg',
  'download-png',
  'download-jpg',
]);

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
    formulaDefaultAction: normalizeFormulaDefaultAction(
      input?.formulaDefaultAction,
      input?.formulaCopyFormat,
    ),
    chatExportButtonPosition: normalizeChatExportButtonPosition(input?.chatExportButtonPosition),
  };
}

function normalizeFormulaDefaultAction(
  action: unknown,
  legacyFormat: unknown,
): FormulaClickAction {
  if (typeof action === 'string' && FORMULA_CLICK_ACTIONS.has(action as FormulaClickAction)) {
    return action as FormulaClickAction;
  }

  if (legacyFormat === 'native') return 'copy-tex-native';
  return DEFAULT_SETTINGS.formulaDefaultAction;
}

function normalizeChatExportButtonPosition(input: unknown): ChatExportButtonPosition | null {
  if (!input || typeof input !== 'object') return DEFAULT_SETTINGS.chatExportButtonPosition;

  const position = input as Partial<ChatExportButtonPosition>;
  if (!isValidPositionValue(position.top) || !isValidPositionValue(position.right)) {
    return DEFAULT_SETTINGS.chatExportButtonPosition;
  }

  return {
    top: Math.round(position.top),
    right: Math.round(position.right),
  };
}

function isValidPositionValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000;
}
