import { logger } from '@/src/core/logger';
import { storageGet, storageSet } from '@/src/core/storage';

import type { ConversationInput } from './types';

const RECENT_CONVERSATIONS_KEY = 'dse.recentConversations.v1';
const MAX_RECENT_CONVERSATIONS = 120;

const log = logger.child('RecentConversationService');

export async function readRecentConversations(): Promise<ConversationInput[]> {
  return (await storageGet<ConversationInput[]>('local', RECENT_CONVERSATIONS_KEY)) ?? [];
}

export async function cacheRecentConversations(conversations: ConversationInput[]): Promise<void> {
  if (conversations.length === 0) return;

  const current = await readRecentConversations();
  const byId = new Map<string, ConversationInput>();

  for (const conversation of [...conversations, ...current]) {
    if (!conversation.id || !conversation.url) continue;
    byId.set(conversation.id, conversation);
  }

  const next = Array.from(byId.values()).slice(0, MAX_RECENT_CONVERSATIONS);
  await storageSet('local', RECENT_CONVERSATIONS_KEY, next);
  log.debug('Recent conversations cached', { count: next.length });
}
