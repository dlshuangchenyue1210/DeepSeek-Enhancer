import { describe, expect, it } from 'vitest';

import { normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('keeps a valid formula default action', () => {
    expect(
      normalizeSettings({
        formulaDefaultAction: 'copy-mathml',
      }).formulaDefaultAction,
    ).toBe('copy-mathml');
  });

  it('derives the formula default action from legacy native format', () => {
    expect(
      normalizeSettings({
        formulaCopyFormat: 'native',
      }).formulaDefaultAction,
    ).toBe('copy-tex-native');
  });

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
