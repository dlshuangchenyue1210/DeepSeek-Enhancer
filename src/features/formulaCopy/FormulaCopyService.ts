import { logger } from '@/src/core/logger';
import {
  SETTINGS_KEY,
  type FormulaClickAction,
  type FormulaCopyFormat,
  getSettings,
  normalizeSettings,
} from '@/src/core/settings';
import { onStorageChanged } from '@/src/core/storage';
import type { DeepSeekFormula } from '@/src/platform/deepseek/types';

import { renderFormulaRaster, renderFormulaSvg } from './FormulaImageRenderer';

type FormulaResolver = (target: EventTarget | null) => DeepSeekFormula | null;

const TOAST_DURATION_MS = 1600;
const TOAST_OFFSET_Y = 36;
const FORMULA_ACTION_LABELS: Record<FormulaClickAction, string> = {
  'copy-tex-dollar': '复制 TeX：$...$',
  'copy-tex-native': '复制 TeX：\\(...\\)',
  'copy-tex-source': '复制 TeX 源码',
  'copy-mathml': '复制 MathML',
  'copy-svg': '复制 SVG 图片',
  'copy-png': '复制 PNG 图片',
  'copy-jpg': '复制 JPG 图片',
  'download-svg': '下载 SVG 图片',
  'download-png': '下载 PNG 图片',
  'download-jpg': '下载 JPG 图片',
};
const FORMULA_MENU_ACTIONS = Object.keys(FORMULA_ACTION_LABELS) as FormulaClickAction[];

export class FormulaCopyService {
  private readonly log = logger.child('FormulaCopy');
  private initialized = false;
  private defaultAction: FormulaClickAction = 'copy-tex-dollar';
  private removeStorageListener: (() => void) | null = null;
  private menu: HTMLDivElement | null = null;
  private toast: HTMLDivElement | null = null;
  private toastTimer: number | null = null;

  constructor(private readonly resolveFormula: FormulaResolver) {}

  initialize(): void {
    if (this.initialized) return;

    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('contextmenu', this.handleContextMenu, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    this.removeStorageListener = onStorageChanged((changes, area) => {
      if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
      this.defaultAction = normalizeSettings(
        changes[SETTINGS_KEY].newValue as Parameters<typeof normalizeSettings>[0],
      ).formulaDefaultAction;
      this.log.debug('Formula default action changed', { action: this.defaultAction });
    });

    void this.loadSettings();
    this.initialized = true;
    this.log.info('Formula copy service initialized');
  }

  destroy(): void {
    if (!this.initialized) return;

    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('contextmenu', this.handleContextMenu, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    this.removeStorageListener?.();
    this.removeStorageListener = null;
    this.removeMenu();
    this.removeToast();
    this.initialized = false;
    this.log.info('Formula copy service destroyed');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private async loadSettings(): Promise<void> {
    try {
      this.defaultAction = (await getSettings()).formulaDefaultAction;
      this.log.debug('Formula copy settings loaded', { action: this.defaultAction });
    } catch (error) {
      this.log.warn('Failed to load formula copy settings', { error });
    }
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.menu?.contains(event.target as Node | null)) return;
    this.removeMenu();

    const formula = this.resolveFormula(event.target);
    if (!formula) return;

    void this.runAction(this.defaultAction, formula, event.clientX, event.clientY);

    event.preventDefault();
    event.stopPropagation();
  };

  private handleContextMenu = (event: MouseEvent): void => {
    const formula = this.resolveFormula(event.target);
    if (!formula) return;

    this.log.debug('Formula context menu opened');
    this.showMenu(formula, event.clientX, event.clientY);
    event.preventDefault();
    event.stopPropagation();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.removeMenu();
  };

  private async runAction(
    action: FormulaClickAction,
    formula: DeepSeekFormula,
    x: number,
    y: number,
  ): Promise<void> {
    this.removeMenu();
    this.log.debug('Formula action started', { action });

    try {
      const result = await executeFormulaAction(action, formula);
      this.showToast(result.message, x, y, result.success);

      if (result.success) this.log.debug('Formula action completed', { action });
      else this.log.error('Formula action failed', { action });
    } catch (error) {
      this.showToast('操作失败', x, y, false);
      this.log.error('Formula action threw', { action, error });
    }
  }

  private showMenu(formula: DeepSeekFormula, x: number, y: number): void {
    this.removeMenu();

    const menu = document.createElement('div');
    menu.className = 'dse-formula-menu';
    menu.dataset.dseRoot = 'true';
    menu.setAttribute('role', 'menu');

    for (const action of FORMULA_MENU_ACTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.textContent = FORMULA_ACTION_LABELS[action];
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.runAction(action, formula, x, y);
      });
      menu.appendChild(button);
    }

    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const left = Math.min(Math.max(x, 8), Math.max(8, window.innerWidth - rect.width - 8));
    const top = Math.min(Math.max(y, 8), Math.max(8, window.innerHeight - rect.height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    this.menu = menu;
  }

  private removeMenu(): void {
    this.menu?.remove();
    this.menu = null;
  }

  private showToast(message: string, x: number, y: number, success: boolean): void {
    const toast = this.ensureToast();
    const left = Math.min(Math.max(x, 12), window.innerWidth - 12);
    const top = Math.min(Math.max(y - TOAST_OFFSET_Y, 12), window.innerHeight - 12);

    toast.textContent = message;
    toast.style.left = `${left}px`;
    toast.style.top = `${top}px`;
    toast.dataset.state = success ? 'success' : 'error';
    toast.dataset.visible = 'true';

    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      toast.dataset.visible = 'false';
      this.toastTimer = null;
    }, TOAST_DURATION_MS);
  }

  private ensureToast(): HTMLDivElement {
    if (this.toast) return this.toast;

    const toast = document.createElement('div');
    toast.className = 'dse-formula-copy-toast';
    toast.dataset.visible = 'false';
    document.body.appendChild(toast);
    this.toast = toast;
    return toast;
  }

  private removeToast(): void {
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    this.toast?.remove();
    this.toast = null;
  }
}

export function formatFormulaForCopy(
  latex: string,
  display: boolean,
  format: FormulaCopyFormat,
): string {
  return formatFormulaText(
    latex,
    display,
    format === 'native' ? 'copy-tex-native' : 'copy-tex-dollar',
  );
}

export function formatFormulaText(
  latex: string,
  display: boolean,
  action: Extract<
    FormulaClickAction,
    'copy-tex-dollar' | 'copy-tex-native' | 'copy-tex-source'
  >,
): string {
  if (action === 'copy-tex-source') return latex;
  if (action === 'copy-tex-native') return display ? `\\[\n${latex}\n\\]` : `\\(${latex}\\)`;
  return display ? `$$\n${latex}\n$$` : `$${latex}$`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return copyTextWithLegacyFallback(text);
    }
  }

  return copyTextWithLegacyFallback(text);
}

async function copyMathMLToClipboard(mathml: string): Promise<boolean> {
  const html = buildMathMLClipboardHtml(mathml);
  const ClipboardItemCtor = window.ClipboardItem;

  if (navigator.clipboard?.write && ClipboardItemCtor) {
    try {
      const items: Record<string, Blob> = {
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([mathml], { type: 'text/plain' }),
      };

      if (clipboardItemSupports(ClipboardItemCtor, 'application/mathml+xml')) {
        items['application/mathml+xml'] = new Blob([mathml], {
          type: 'application/mathml+xml',
        });
      }

      await navigator.clipboard.write([new ClipboardItemCtor(items)]);
      return true;
    } catch {
      return copyHtmlWithLegacyFallback(html, mathml);
    }
  }

  return copyHtmlWithLegacyFallback(html, mathml);
}

function clipboardItemSupports(ClipboardItemCtor: typeof ClipboardItem, mimeType: string): boolean {
  const supports = (
    ClipboardItemCtor as typeof ClipboardItem & { supports?: (type: string) => boolean }
  ).supports;
  return typeof supports === 'function' && supports(mimeType);
}

function buildMathMLClipboardHtml(mathml: string): string {
  return `<!doctype html><html><body>${mathml}</body></html>`;
}

function copyTextWithLegacyFallback(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  textarea.setAttribute('readonly', '');

  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

function copyHtmlWithLegacyFallback(html: string, plainText: string): boolean {
  const container = document.createElement('div');
  container.contentEditable = 'true';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.opacity = '0';
  container.innerHTML = html;

  document.body.appendChild(container);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);

  try {
    return document.execCommand('copy') || copyTextWithLegacyFallback(plainText);
  } finally {
    selection?.removeAllRanges();
    container.remove();
  }
}

async function executeFormulaAction(
  action: FormulaClickAction,
  formula: DeepSeekFormula,
): Promise<{ success: boolean; message: string }> {
  if (action === 'copy-mathml') {
    if (!formula.mathml) return { success: false, message: '未找到 MathML' };
    const success = await copyMathMLToClipboard(formula.mathml);
    return {
      success,
      message: success ? 'MathML 已复制' : '复制失败',
    };
  }

  if (
    action === 'copy-tex-dollar' ||
    action === 'copy-tex-native' ||
    action === 'copy-tex-source'
  ) {
    const text = formatFormulaText(formula.latex, formula.display, action);
    const success = await copyTextToClipboard(text);
    return {
      success,
      message: success ? '公式已复制' : '复制失败',
    };
  }

  if (action === 'copy-svg') {
    const blob = await renderFormulaSvg(formula);
    const success = await copyBlobToClipboard(blob, 'image/svg+xml');
    return {
      success,
      message: success ? 'SVG 已复制' : '复制失败',
    };
  }

  if (action === 'copy-png' || action === 'copy-jpg') {
    const format = action === 'copy-png' ? 'png' : 'jpg';
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await renderFormulaRaster(formula, format);
    const success = await copyBlobToClipboard(blob, mimeType);
    return {
      success,
      message: success ? `${format.toUpperCase()} 已复制` : '复制失败',
    };
  }

  if (action === 'download-svg') {
    downloadBlob(await renderFormulaSvg(formula), formulaFilename(formula, 'svg'));
    return { success: true, message: 'SVG 已下载' };
  }

  if (action === 'download-png' || action === 'download-jpg') {
    const format = action === 'download-png' ? 'png' : 'jpg';
    downloadBlob(await renderFormulaRaster(formula, format), formulaFilename(formula, format));
    return { success: true, message: `${format.toUpperCase()} 已下载` };
  }

  return { success: false, message: '不支持的操作' };
}

async function copyBlobToClipboard(blob: Blob, mimeType: string): Promise<boolean> {
  const ClipboardItemCtor = window.ClipboardItem;
  if (!navigator.clipboard?.write || !ClipboardItemCtor) return false;

  try {
    await navigator.clipboard.write([new ClipboardItemCtor({ [mimeType]: blob })]);
    return true;
  } catch {
    return false;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formulaFilename(formula: DeepSeekFormula, extension: string): string {
  const slug = formula.latex
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  return `deepseek-formula-${slug || 'math'}.${extension}`;
}
