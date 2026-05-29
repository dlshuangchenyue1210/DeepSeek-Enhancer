import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppSettings } from '@/src/core/settings';

import { FormulaCopyService, formatFormulaForCopy, formatFormulaText } from './FormulaCopyService';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn<() => Promise<AppSettings>>(),
  removeStorageListener: vi.fn(),
}));

vi.mock('@/src/core/settings', () => ({
  SETTINGS_KEY: 'dse.settings',
  getSettings: mocks.getSettings,
  normalizeSettings: (input: Partial<AppSettings> | undefined): AppSettings => ({
    folderItemDropAction:
      input?.folderItemDropAction === 'copy' || input?.folderItemDropAction === 'move'
        ? input.folderItemDropAction
        : 'move',
    formulaCopyFormat:
      input?.formulaCopyFormat === 'native' || input?.formulaCopyFormat === 'dollar'
        ? input.formulaCopyFormat
        : 'dollar',
    formulaDefaultAction:
      typeof input?.formulaDefaultAction === 'string'
        ? input.formulaDefaultAction
        : input?.formulaCopyFormat === 'native'
          ? 'copy-tex-native'
          : 'copy-tex-dollar',
    chatExportButtonPosition: null,
  }),
}));

vi.mock('@/src/core/storage', () => ({
  onStorageChanged: vi.fn(() => mocks.removeStorageListener),
}));

describe('FormulaCopyService', () => {
  const writeText = vi.fn<() => Promise<void>>();
  const write = vi.fn<(items: MockClipboardItem[]) => Promise<void>>();

  class MockClipboardItem {
    static supports(): boolean {
      return false;
    }

    constructor(public readonly items: Record<string, Blob>) {}
  }

  beforeEach(() => {
    mocks.getSettings.mockResolvedValue({
      folderItemDropAction: 'move',
      formulaCopyFormat: 'dollar',
      formulaDefaultAction: 'copy-tex-dollar',
      chatExportButtonPosition: null,
    });
    writeText.mockResolvedValue(undefined);
    write.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText },
    });
    Object.defineProperty(window, 'ClipboardItem', {
      configurable: true,
      value: MockClipboardItem,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('formats formulas using dollar delimiters by default', () => {
    expect(formatFormulaForCopy('x^2', false, 'dollar')).toBe('$x^2$');
    expect(formatFormulaForCopy('x^2', true, 'dollar')).toBe('$$\nx^2\n$$');
  });

  it('formats formulas using DeepSeek native delimiters', () => {
    expect(formatFormulaForCopy('x^2', false, 'native')).toBe('\\(x^2\\)');
    expect(formatFormulaForCopy('x^2', true, 'native')).toBe('\\[\nx^2\n\\]');
  });

  it('formats formulas using raw TeX source', () => {
    expect(formatFormulaText('x^2', false, 'copy-tex-source')).toBe('x^2');
  });

  it('copies the clicked formula and shows a success toast', async () => {
    const formulaElement = document.createElement('span');
    document.body.appendChild(formulaElement);

    const service = new FormulaCopyService((target) =>
      target === formulaElement
        ? {
            element: formulaElement,
            latex: 'x^2',
            mathml: '<math><mi>x</mi></math>',
            display: false,
          }
        : null,
    );

    service.initialize();
    formulaElement.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 120, clientY: 80 }),
    );

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('$x^2$');
      expect(document.querySelector('.dse-formula-copy-toast')?.textContent).toBe('公式已复制');
    });

    service.destroy();
    expect(mocks.removeStorageListener).toHaveBeenCalled();
  });

  it('shows a formula context menu and copies MathML from it', async () => {
    const formulaElement = document.createElement('span');
    document.body.appendChild(formulaElement);

    const service = new FormulaCopyService((target) =>
      target === formulaElement
        ? {
            element: formulaElement,
            latex: 'x^2',
            mathml: '<math><msup><mi>x</mi><mn>2</mn></msup></math>',
            display: false,
          }
        : null,
    );

    service.initialize();
    formulaElement.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 80 }),
    );

    const mathmlButton = Array.from(document.querySelectorAll('.dse-formula-menu button')).find(
      (button) => button.textContent === '复制 MathML',
    );
    expect(mathmlButton).toBeInstanceOf(HTMLButtonElement);
    mathmlButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(write).toHaveBeenCalledTimes(1);
      const item = write.mock.calls[0]?.[0]?.[0] as MockClipboardItem;
      expect(Object.keys(item.items)).toEqual(['text/html', 'text/plain']);
      expect(document.querySelector('.dse-formula-copy-toast')?.textContent).toBe(
        'MathML 已复制',
      );
    });

    service.destroy();
  });
});
