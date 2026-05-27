import { describe, expect, it } from 'vitest';

import { compactAssistantPreview } from './ExportChatButton';

describe('compactAssistantPreview', () => {
  it('returns short content without ellipsis', () => {
    expect(compactAssistantPreview('短回复', 8)).toEqual(['短回复']);
  });

  it('splits content that fits in two lines without ellipsis', () => {
    expect(compactAssistantPreview('abcdefghijkl', 8)).toEqual(['abcdefgh', 'ijkl']);
  });

  it('uses head and tail lines for long content without trailing ellipsis on the tail', () => {
    expect(compactAssistantPreview('abcdefghijklmnopqrstuvwxyz', 8)).toEqual(['abcde...', '...vwxyz']);
  });
});
