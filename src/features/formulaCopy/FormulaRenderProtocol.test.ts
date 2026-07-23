import { describe, expect, it } from 'vitest';

import { FORMULA_RENDER_MESSAGE, isFormulaRenderRequest } from './FormulaRenderProtocol';

describe('formula render protocol', () => {
  it('accepts a complete render request', () => {
    expect(
      isFormulaRenderRequest({
        type: FORMULA_RENDER_MESSAGE,
        latex: 'x^2',
        display: true,
        format: 'png',
      }),
    ).toBe(true);
  });

  it('rejects malformed or unsupported requests', () => {
    expect(
      isFormulaRenderRequest({
        type: FORMULA_RENDER_MESSAGE,
        latex: '',
        display: true,
        format: 'webp',
      }),
    ).toBe(false);
  });
});
