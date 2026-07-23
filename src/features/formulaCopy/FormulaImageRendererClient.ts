import { browser } from 'wxt/browser';

import type { DeepSeekFormula } from '@/src/platform/deepseek/types';

import {
  FORMULA_RENDER_MESSAGE,
  type FormulaRenderFormat,
  type FormulaRenderRequest,
  type FormulaRenderResponse,
} from './FormulaRenderProtocol';

const RENDERER_PATH = '/formula-renderer.html';
const RENDER_TIMEOUT_MS = 20_000;
let rendererFramePromise: Promise<HTMLIFrameElement> | null = null;

export async function renderFormulaSvg(formula: DeepSeekFormula): Promise<Blob> {
  return requestFormulaRender(formula, 'svg');
}

export async function renderFormulaRaster(
  formula: DeepSeekFormula,
  format: Exclude<FormulaRenderFormat, 'svg'>,
): Promise<Blob> {
  return requestFormulaRender(formula, format);
}

async function requestFormulaRender(
  formula: DeepSeekFormula,
  format: FormulaRenderFormat,
): Promise<Blob> {
  const frame = await ensureRendererFrame();
  if (!frame.contentWindow) throw new Error('Formula renderer frame is unavailable');

  const request: FormulaRenderRequest = {
    type: FORMULA_RENDER_MESSAGE,
    latex: formula.latex,
    display: formula.display,
    format,
  };
  const channel = new MessageChannel();
  const response = new Promise<Blob>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('Formula rendering timed out'));
    }, RENDER_TIMEOUT_MS);
    channel.port1.onmessage = (event: MessageEvent<FormulaRenderResponse>) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      if (event.data?.ok) resolve(event.data.blob);
      else reject(new Error(event.data?.error ?? 'Formula rendering failed'));
    };
    channel.port1.start();
  });

  frame.contentWindow.postMessage(request, extensionOrigin(), [channel.port2]);
  return response;
}

function ensureRendererFrame(): Promise<HTMLIFrameElement> {
  const existing = document.querySelector<HTMLIFrameElement>('[data-dse-formula-renderer]');
  if (existing?.contentWindow) return Promise.resolve(existing);
  if (rendererFramePromise) return rendererFramePromise;

  rendererFramePromise = new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.dataset.dseFormulaRenderer = 'true';
    frame.dataset.dseRoot = 'true';
    frame.hidden = true;
    frame.src = browser.runtime.getURL(RENDERER_PATH);
    frame.onload = () => resolve(frame);
    frame.onerror = () => {
      rendererFramePromise = null;
      frame.remove();
      reject(new Error('Formula renderer failed to load'));
    };
    document.documentElement.appendChild(frame);
  });
  return rendererFramePromise;
}

function extensionOrigin(): string {
  return new URL(browser.runtime.getURL('/')).origin;
}
