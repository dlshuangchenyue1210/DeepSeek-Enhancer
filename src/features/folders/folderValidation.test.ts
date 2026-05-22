import { describe, expect, it } from 'vitest';

import { validateFolderData } from './folderValidation';
import type { FolderData } from './types';

describe('validateFolderData', () => {
  it('accepts a valid two-level folder tree', () => {
    const data: FolderData = {
      folders: [
        {
          id: 'root',
          name: 'Root',
          parentId: null,
          order: 0,
          pinned: false,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'child',
          name: 'Child',
          parentId: 'root',
          order: 0,
          pinned: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      items: [
        {
          id: 'item',
          folderId: 'child',
          conversationId: 'conv',
          title: 'Conversation',
          url: 'https://chat.deepseek.com/a/chat/s/conv',
          addedAt: 1,
          order: 0,
        },
      ],
      updatedAt: 1,
    };

    expect(validateFolderData(data)).toEqual([]);
  });

  it('rejects duplicate conversations in one folder', () => {
    const data: FolderData = {
      folders: [
        {
          id: 'root',
          name: 'Root',
          parentId: null,
          order: 0,
          pinned: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      items: [
        {
          id: 'item-a',
          folderId: 'root',
          conversationId: 'conv',
          title: 'Conversation',
          url: 'https://chat.deepseek.com/a/chat/s/conv',
          addedAt: 1,
          order: 0,
        },
        {
          id: 'item-b',
          folderId: 'root',
          conversationId: 'conv',
          title: 'Conversation',
          url: 'https://chat.deepseek.com/a/chat/s/conv',
          addedAt: 2,
          order: 1,
        },
      ],
      updatedAt: 1,
    };

    expect(validateFolderData(data)).toContain('duplicate conversation in folder: root:conv');
  });
});
