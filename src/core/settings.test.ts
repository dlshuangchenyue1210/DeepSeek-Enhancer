import { describe, expect, it } from 'vitest';

import { normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('keeps a valid chat export button position', () => {
    expect(
      normalizeSettings({
        chatExportButtonPosition: { top: 120.4, right: 32.6 },
      }).chatExportButtonPosition,
    ).toEqual({ top: 120, right: 33 });
  });

  it('ignores an invalid chat export button position', () => {
    expect(
      normalizeSettings({
        chatExportButtonPosition: { top: -1, right: Number.NaN },
      }).chatExportButtonPosition,
    ).toBeNull();
  });
});
