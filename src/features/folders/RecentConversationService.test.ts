import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock('@/src/core/storage', () => ({
  storageGet: storage.get,
  storageSet: storage.set,
}));

import { cacheRecentConversations, readRecentConversations } from './RecentConversationService';

describe('cacheRecentConversations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('promotes fresh conversations and keeps their latest title', async () => {
    storage.get.mockResolvedValue([
      conversation('old', 'Old'),
      conversation('current', 'Stale title'),
    ]);

    await cacheRecentConversations([conversation('current', 'Fresh title')]);

    expect(storage.set).toHaveBeenCalledWith('local', 'dse.recentConversations.v1', [
      conversation('current', 'Fresh title'),
      conversation('old', 'Old'),
    ]);
  });

  it('does not write when the cache content and order are unchanged', async () => {
    storage.get.mockResolvedValue([conversation('current', 'Current')]);

    await cacheRecentConversations([conversation('current', 'Current')]);

    expect(storage.set).not.toHaveBeenCalled();
  });

  it('ignores a malformed cache value', async () => {
    storage.get.mockResolvedValue({ invalid: true });
    await expect(readRecentConversations()).resolves.toEqual([]);
  });
});

function conversation(id: string, title: string) {
  return { id, title, url: `https://chat.deepseek.com/a/chat/s/${id}` };
}
