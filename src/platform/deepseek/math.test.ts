import { afterEach, describe, expect, it, vi } from 'vitest';

import { findFormulaFromTarget, markFormulaElements } from './math';

describe('DeepSeek math adapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('extracts TeX from a clicked DeepSeek block formula', () => {
    document.body.innerHTML = `
      <span class="katex-display ds-markdown-math">
        <span class="katex">
          <span class="katex-mathml">
            <math>
              <semantics>
                <mrow></mrow>
                <annotation encoding="application/x-tex">(\\tan x)' = \\sec^2 x.</annotation>
              </semantics>
            </math>
          </span>
          <span class="katex-html"><span class="mop">=</span></span>
        </span>
      </span>
    `;

    const target = document.querySelector('.mop');
    const formula = findFormulaFromTarget(target);

    expect(formula?.latex).toBe("(\\tan x)' = \\sec^2 x.");
    expect(formula?.mathml).toContain('application/x-tex');
    expect(formula?.display).toBe(true);
    expect(formula?.element.classList.contains('katex-display')).toBe(true);
  });

  it('detects inline formulas without display wrapping', () => {
    document.body.innerHTML = `
      <span class="ds-markdown-math">
        <span class="katex">
          <span class="katex-mathml">
            <math>
              <semantics>
                <mrow></mrow>
                <annotation encoding="application/x-tex">\\sec^2 x</annotation>
              </semantics>
            </math>
          </span>
          <span class="katex-html"><span class="mord">sec</span></span>
        </span>
      </span>
    `;

    const formula = findFormulaFromTarget(document.querySelector('.mord'));

    expect(formula?.latex).toBe('\\sec^2 x');
    expect(formula?.mathml).toContain('<math');
    expect(formula?.display).toBe(false);
  });

  it('marks a newly inserted formula root without scanning the document', () => {
    const formula = document.createElement('span');
    formula.className = 'katex';
    formula.dataset.tex = 'x^2';
    document.body.appendChild(formula);
    const query = vi.spyOn(document, 'querySelectorAll');

    expect(markFormulaElements(formula)).toBe(1);
    expect(formula.dataset.dseFormulaCopy).toBe('true');
    expect(query).not.toHaveBeenCalled();
    query.mockRestore();
  });

  it('marks a formula when its TeX annotation arrives later', () => {
    document.body.innerHTML = '<span class="katex"><math></math></span>';
    const host = document.querySelector<HTMLElement>('.katex')!;
    expect(markFormulaElements(host)).toBe(0);
    const annotation = document.createElement('annotation');
    annotation.setAttribute('encoding', 'application/x-tex');
    annotation.textContent = 'x^2';
    host.querySelector('math')!.appendChild(annotation);

    expect(markFormulaElements(annotation)).toBe(1);
    expect(host.dataset.dseFormulaCopy).toBe('true');
  });

  it('does not rewrite unchanged formula markers', () => {
    document.body.innerHTML = '<span class="katex" data-tex="x^2"></span>';
    expect(markFormulaElements()).toBe(1);
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, { attributes: true, subtree: true });

    expect(markFormulaElements()).toBe(1);
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });

  it('marks formula hosts for extension-owned hover styles', () => {
    document.body.innerHTML = `
      <main>
        <span class="ds-markdown-math">
          <span class="katex">
            <math>
              <semantics>
                <mrow></mrow>
                <annotation encoding="application/x-tex">x^2</annotation>
              </semantics>
            </math>
          </span>
        </span>
      </main>
    `;

    expect(markFormulaElements()).toBe(1);
    expect(document.querySelector('.ds-markdown-math')?.getAttribute('data-dse-formula-copy')).toBe(
      'true',
    );
  });
});
