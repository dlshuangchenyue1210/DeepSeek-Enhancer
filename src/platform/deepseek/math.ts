import { logger } from '@/src/core/logger';

const log = logger.child('DeepSeekMath');

const FORMULA_SELECTOR = [
  '.ds-markdown-math',
  '.katex-display',
  '.katex',
  'math',
].join(',');

const FORMULA_HOST_SELECTOR = '.ds-markdown-math, .katex-display, .katex';

export type DeepSeekFormula = {
  element: HTMLElement;
  latex: string;
  mathml: string | null;
  display: boolean;
};

export function findFormulaFromTarget(target: EventTarget | null): DeepSeekFormula | null {
  if (!(target instanceof Element)) return null;

  const candidate = target.closest(FORMULA_SELECTOR);
  if (!candidate) return null;

  const latex = extractFormulaLatex(candidate);
  if (!latex) {
    log.warn('Formula element found without TeX source');
    return null;
  }

  const element = getFormulaHost(candidate);
  if (!element) return null;

  return {
    element,
    latex,
    mathml: extractFormulaMathML(candidate),
    display: isDisplayFormula(candidate),
  };
}

export function markFormulaElements(root: ParentNode = document): number {
  const marked = new Set<HTMLElement>();

  root.querySelectorAll(FORMULA_SELECTOR).forEach((candidate) => {
    if (!extractFormulaLatex(candidate)) return;

    const host = getFormulaHost(candidate);
    if (!host || marked.has(host)) return;

    host.dataset.dseFormulaCopy = 'true';
    marked.add(host);
  });

  if (marked.size > 0) log.debug('Formula elements marked', { count: marked.size });
  return marked.size;
}

function getFormulaHost(element: Element): HTMLElement | null {
  const displayHost = element.closest('.katex-display, .ds-markdown-math');
  if (displayHost instanceof HTMLElement) return displayHost;

  const host = element.closest(FORMULA_HOST_SELECTOR);
  if (host instanceof HTMLElement) return host;

  return element instanceof HTMLElement ? element : element.parentElement;
}

function extractFormulaLatex(element: Element): string | null {
  const direct =
    element.getAttribute('data-math') ??
    element.getAttribute('data-tex') ??
    element.getAttribute('data-latex');
  if (direct?.trim()) return direct.trim();

  const annotation =
    element.querySelector('annotation[encoding*="tex" i]') ?? element.querySelector('annotation');
  const latex = annotation?.textContent?.trim();
  return latex || null;
}

function extractFormulaMathML(element: Element): string | null {
  const math = element.matches('math') ? element : element.querySelector('math');
  if (!math) return null;

  try {
    return new XMLSerializer().serializeToString(math).trim();
  } catch {
    return math.outerHTML?.trim() || null;
  }
}

function isDisplayFormula(element: Element): boolean {
  return (
    element.classList.contains('katex-display') ||
    element.closest('.katex-display') !== null ||
    element.getAttribute('display') === 'block' ||
    element.querySelector('math[display="block"]') !== null
  );
}
