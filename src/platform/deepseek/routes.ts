const CONVERSATION_PATH_RE = /^\/a\/chat\/s\/([a-f0-9-]{20,})/i;

export function isDeepSeekHost(hostname = location.hostname): boolean {
  return hostname === 'chat.deepseek.com';
}

export function isConversationRoute(pathname = location.pathname): boolean {
  return CONVERSATION_PATH_RE.test(pathname);
}

export function getConversationIdFromPath(pathname = location.pathname): string | null {
  return CONVERSATION_PATH_RE.exec(pathname)?.[1] ?? null;
}

export function buildConversationUrl(conversationId: string): string {
  return `https://chat.deepseek.com/a/chat/s/${conversationId}`;
}
