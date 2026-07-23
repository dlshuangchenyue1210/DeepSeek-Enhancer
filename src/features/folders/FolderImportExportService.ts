import type { FolderData, FolderExportPayload } from './types';
import { assertValidFolderData } from './folderValidation';

const FORMAT = 'deepseek-enhancer.folders.v1' as const;
const VERSION = '0.1.0';

export function toFolderExportPayload(data: FolderData): FolderExportPayload {
  assertValidFolderData(data);
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function parseFolderExportPayload(input: unknown): FolderExportPayload {
  if (!input || typeof input !== 'object') throw new Error('Invalid folder import payload');

  const payload = input as Partial<FolderExportPayload>;
  if (payload.format !== FORMAT) {
    throw new Error(`Unsupported folder payload format: ${String(payload.format)}`);
  }

  if (payload.version !== VERSION) {
    throw new Error(`Unsupported folder payload version: ${String(payload.version)}`);
  }
  if (
    typeof payload.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(payload.exportedAt))
  ) {
    throw new Error('Folder payload exportedAt is invalid');
  }

  if (!payload.data) throw new Error('Folder payload data is missing');
  assertValidFolderData(payload.data);

  return structuredClone(payload) as FolderExportPayload;
}

export function downloadFolderPayload(payload: FolderExportPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `deepseek-enhancer-folders-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
