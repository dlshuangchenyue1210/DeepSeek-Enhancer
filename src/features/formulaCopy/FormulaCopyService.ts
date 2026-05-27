import { logger } from '@/src/core/logger';
import {
  SETTINGS_KEY,
  type FormulaCopyFormat,
  getSettings,
  normalizeSettings,
} from '@/src/core/settings';
import { onStorageChanged } from '@/src/core/storage';
import type { DeepSeekFormula } from '@/src/platform/deepseek/types';

type FormulaResolver = (target: EventTarget | null) => DeepSeekFormula | null;

const TOAST_DURATION_MS = 1600;
const TOAST_OFFSET_Y = 36;

export class FormulaCopyService {
  private readonly log = logger.child('FormulaCopy');
  private initialized = false;
  private format: FormulaCopyFormat = 'dollar';
  private removeStorageListener: (() => void) | null = null;
  private toast: HTMLDivElement | null = null;
  private toastTimer: number | null = null;

  constructor(private readonly resolveFormula: FormulaResolver) {}

  initialize(): void {
    if (this.initialized) return;

    document.addEventListener('click', this.handleClick, true);
    this.removeStorageListener = onStorageChanged((changes, area) => {
      if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
      this.format = normalizeSettings(
        changes[SETTINGS_KEY].newValue as Parameters<typeof normalizeSettings>[0],
      ).formulaCopyFormat;
      this.log.debug('Formula copy format changed', { format: this.format });
    });

    void this.loadSettings();
    this.initialized = true;
    this.log.info('Formula copy service initialized');
  }

  destroy(): void {
    if (!this.initialized) return;

    document.removeEventListener('click', this.handleClick, true);
    this.removeStorageListener?.();
    this.removeStorageListener = null;
    this.removeToast();
    this.initialized = false;
    this.log.info('Formula copy service destroyed');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private async loadSettings(): Promise<void> {
    try {
      this.format = (await getSettings()).formulaCopyFormat;
      this.log.debug('Formula copy settings loaded', { format: this.format });
    } catch (error) {
      this.log.warn('Failed to load formula copy settings', { error });
    }
  }

  private handleClick = (event: MouseEvent): void => {
    const formula = this.resolveFormula(event.target);
    if (!formula) return;

    const text = formatFormulaForCopy(formula.latex, formula.display, this.format);
    void this.copyFormula(text, event.clientX, event.clientY);

    event.preventDefault();
    event.stopPropagation();
  };

  private async copyFormula(text: string, x: number, y: number): Promise<void> {
    try {
      const copied = await copyTextToClipboard(text);
      this.showToast(copied ? '公式已复制' : '复制失败', x, y, copied);

      if (copied) this.log.debug('Formula copied', { format: this.format, length: text.length });
      else this.log.error('Formula copy failed');
    } catch (error) {
      this.showToast('复制失败', x, y, false);
      this.log.error('Formula copy threw', { error });
    }
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
  if (format === 'native') {
    return display ? `\\[\n${latex}\n\\]` : `\\(${latex}\\)`;
  }

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
