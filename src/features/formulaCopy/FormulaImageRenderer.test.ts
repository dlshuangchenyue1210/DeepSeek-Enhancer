import { afterEach, describe, expect, it } from 'vitest';

import { renderFormulaSvg } from './FormulaImageRenderer';

describe('FormulaImageRenderer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders TeX to an SVG blob without a browser extension runtime', async () => {
    const blob = await renderFormulaSvg({
      element: document.body,
      latex: 'x^2 + y^2 = z^2',
      mathml: null,
      display: true,
    });

    expect(blob.type).toBe('image/svg+xml;charset=utf-8');
    expect(blob.size).toBeGreaterThan(100);
  }, 15_000);
});
