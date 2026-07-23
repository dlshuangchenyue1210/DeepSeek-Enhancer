import { logger } from '@/src/core/logger';
import { storageGet, storageSet } from '@/src/core/storage';

import type { ConversationInput } from './types';

const RECENT_CONVERSATIONS_KEY = 'dse.recentConversations.v1';
const MAX_RECENT_CONVERSATIONS = 120;

const log = logger.child('RecentConversationService');

export async function readRecentConversations(): Promise<ConversationInput[]> {
  const stored = await storageGet<unknown>('local', RECENT_CONVERSATIONS_KEY);
  if (stored === undefined) return [];
  if (!Array.isArray(stored)) {
    log.warn('Invalid recent conversation cache ignored');
    return [];
  }
  return stored.filter(isConversationInput);
}

function isConversationInput(value: unknown): value is ConversationInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<ConversationInput>).id === 'string' &&
    typeof (value as Partial<ConversationInput>).title === 'string' &&
    typeof (value as Partial<ConversationInput>).url === 'string'
  );
}

export async function cacheRecentConversations(conversations: ConversationInput[]): Promise<void> {
  if (conversations.length === 0) return;

  const current = await readRecentConversations();
  const byId = new Map<string, ConversationInput>();

  for (const conversation of [...current, ...conversations]) {
    if (!conversation.id || !conversation.url) continue;
    byId.set(conversation.id, conversation);
  }

  const orderedIds = new Set<string>();
  for (const conversation of [...conversations, ...current]) {
    if (byId.has(conversation.id)) orderedIds.add(conversation.id);
  }
  const next = Array.from(orderedIds, (id) => byId.get(id)!).slice(0, MAX_RECENT_CONVERSATIONS);
  if (sameConversations(current, next)) {
    log.debug('Recent conversation cache unchanged', { count: next.length });
    return;
  }
  await storageSet('local', RECENT_CONVERSATIONS_KEY, next);
  log.debug('Recent conversations cached', { count: next.length });
}

function sameConversations(left: ConversationInput[], right: ConversationInput[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (conversation, index) =>
        conversation.id === right[index]?.id &&
        conversation.title === right[index]?.title &&
        conversation.url === right[index]?.url,
    )
  );
}
