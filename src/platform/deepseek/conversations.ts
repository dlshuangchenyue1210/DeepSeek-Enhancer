import { normalizeText } from '@/src/core/dom';
import { logger } from '@/src/core/logger';

import { buildConversationUrl, getConversationIdFromPath } from './routes';
import { queryAll, selectors } from './selectors';
import type { ConversationRef } from './types';

const log = logger.child('DeepSeekConversation');

export function getCurrentConversation(): ConversationRef | null {
  const id = getConversationIdFromPath();
  if (!id) return null;

  const url = buildConversationUrl(id);
  const title = getConversationTitle(id) || document.title.replace(/\s*-\s*DeepSeek\s*$/i, '');

  const conversation = {
    id,
    title: normalizeText(title) || '未命名对话',
    url,
  };

  log.debug('Current conversation resolved', { id: conversation.id });
  return conversation;
}

function getConversationTitle(id: string): string | null {
  const links = queryAll(document, selectors.conversationLinks);
  const match = links.find((link) => link.getAttribute('href')?.includes(id));
  return match ? normalizeText(match.textContent) : null;
}

export function getRecentConversations(): ConversationRef[] {
  const seen = new Set<string>();
  const conversations: ConversationRef[] = [];

  for (const link of queryAll(document, selectors.conversationLinks)) {
    const href = link.getAttribute('href');
    if (!href) continue;

    let url: URL;
    try {
      url = new URL(href, location.origin);
    } catch {
      continue;
    }

    const id = getConversationIdFromPath(url.pathname);
    if (!id || seen.has(id)) continue;

    seen.add(id);
    conversations.push({
      id,
      title: normalizeText(link.textContent) || '未命名对话',
      url: buildConversationUrl(id),
    });
  }

  log.debug('Recent conversations collected', { count: conversations.length });
  return conversations;
}
