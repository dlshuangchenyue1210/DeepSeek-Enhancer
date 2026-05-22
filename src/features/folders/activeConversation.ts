import { buildConversationUrl, getConversationIdFromPath } from '@/src/platform/deepseek/routes';
import type { ConversationInput } from './types';
import { browser } from 'wxt/browser';

export async function getActiveDeepSeekConversation(): Promise<ConversationInput | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.url) return null;

  const url = new URL(tab.url);
  if (url.hostname !== 'chat.deepseek.com') return null;

  const id = getConversationIdFromPath(url.pathname);
  if (!id) return null;

  return {
    id,
    title: tab.title?.replace(/\s*-\s*DeepSeek\s*$/i, '').trim() || '未命名对话',
    url: buildConversationUrl(id),
  };
}
