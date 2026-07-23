import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock('@/src/core/storage', () => ({
  storageGet: storage.get,
  storageSet: storage.set,
}));

import {
  FOLDER_DATA_KEY,
  FOLDER_RECOVERY_KEY,
  FolderRepository,
} from './FolderRepository';

describe('FolderRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty data only when the main key is absent', async () => {
    storage.get.mockResolvedValue(undefined);
    const data = await new FolderRepository().read();
    expect(data.folders).toEqual([]);
    expect(data.items).toEqual([]);
  });

  it('rejects invalid stored data instead of treating it as empty', async () => {
    storage.get.mockResolvedValue(null);
    await expect(new FolderRepository().read()).rejects.toThrow('Invalid folder data');
  });

  it('preserves invalid raw data under the recovery key', async () => {
    storage.get.mockImplementation(async (_area: string, key: string) =>
      key === FOLDER_RECOVERY_KEY ? [] : undefined,
    );
    const raw = { folders: 'corrupt' };

    await new FolderRepository().preserveInvalidData(raw);

    expect(storage.set).toHaveBeenCalledWith(
      'local',
      FOLDER_RECOVERY_KEY,
      expect.arrayContaining([expect.objectContaining({ data: raw })]),
    );
    expect(storage.set).not.toHaveBeenCalledWith('local', FOLDER_DATA_KEY, expect.anything());
  });
});
