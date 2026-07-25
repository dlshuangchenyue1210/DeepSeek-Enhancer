import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderFormulaSvg } from './FormulaImageRenderer';

describe('FormulaImageRenderer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders TeX without invalid MathJax configuration warnings', async () => {
    const warn = vi.spyOn(console, 'warn');
    const blob = await renderFormulaSvg({
      element: document.body,
      latex: 'x^2 + y^2 = z^2',
      mathml: null,
      display: true,
    });

    expect(blob.type).toBe('image/svg+xml;charset=utf-8');
    expect(blob.size).toBeGreaterThan(100);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('MathJax: Invalid option'));
  }, 15_000);
});
