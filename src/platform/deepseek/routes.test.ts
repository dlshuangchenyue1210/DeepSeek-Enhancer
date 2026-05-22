import { describe, expect, it } from 'vitest';

import { getConversationIdFromPath, isConversationRoute } from './routes';

describe('DeepSeek routes', () => {
  it('detects conversation routes', () => {
    expect(isConversationRoute('/a/chat/s/12345678-1234-1234-1234-123456789abc')).toBe(true);
  });

  it('extracts conversation id', () => {
    expect(getConversationIdFromPath('/a/chat/s/12345678-1234-1234-1234-123456789abc')).toBe(
      '12345678-1234-1234-1234-123456789abc',
    );
  });

  it('ignores non-conversation routes', () => {
    expect(isConversationRoute('/')).toBe(false);
    expect(getConversationIdFromPath('/')).toBeNull();
  });
});
