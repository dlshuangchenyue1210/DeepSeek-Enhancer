import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppSettings } from '@/src/core/settings';

import { FormulaCopyService, formatFormulaForCopy } from './FormulaCopyService';

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
    chatExportButtonPosition: null,
  }),
}));

vi.mock('@/src/core/storage', () => ({
  onStorageChanged: vi.fn(() => mocks.removeStorageListener),
}));

describe('FormulaCopyService', () => {
  const writeText = vi.fn<() => Promise<void>>();

  beforeEach(() => {
    mocks.getSettings.mockResolvedValue({
      folderItemDropAction: 'move',
      formulaCopyFormat: 'dollar',
      chatExportButtonPosition: null,
    });
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
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

  it('copies the clicked formula and shows a success toast', async () => {
    const formulaElement = document.createElement('span');
    document.body.appendChild(formulaElement);

    const service = new FormulaCopyService((target) =>
      target === formulaElement
        ? {
            element: formulaElement,
            latex: 'x^2',
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
});
