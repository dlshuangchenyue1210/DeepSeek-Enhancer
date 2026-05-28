import { describe, expect, it } from 'vitest';

import { clampChatExportButtonPosition, compactAssistantPreview } from './ExportChatButton';

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

describe('clampChatExportButtonPosition', () => {
  it('keeps the button inside the viewport margin', () => {
    expect(
      clampChatExportButtonPosition(
        { top: -12, right: 500 },
        { width: 92, height: 36 },
        { width: 240, height: 160 },
      ),
    ).toEqual({ top: 8, right: 140 });
  });
});
