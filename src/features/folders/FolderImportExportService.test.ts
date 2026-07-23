import { describe, expect, it } from 'vitest';

import { parseFolderExportPayload, toFolderExportPayload } from './FolderImportExportService';
import { createEmptyFolderData } from './folderValidation';

describe('folder import payload validation', () => {
  it('round-trips the current versioned export format', () => {
    const payload = toFolderExportPayload(createEmptyFolderData());
    expect(parseFolderExportPayload(payload)).toEqual(payload);
  });

  it('rejects unsupported versions and invalid export timestamps', () => {
    const payload = toFolderExportPayload(createEmptyFolderData());
    expect(() => parseFolderExportPayload({ ...payload, version: '9.0.0' })).toThrow(
      'Unsupported folder payload version',
    );
    expect(() => parseFolderExportPayload({ ...payload, exportedAt: 'not-a-date' })).toThrow(
      'Folder payload exportedAt is invalid',
    );
  });
});
