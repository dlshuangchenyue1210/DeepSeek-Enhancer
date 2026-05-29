import { logger } from '@/src/core/logger';
import type { DeepSeekFormula } from '@/src/platform/deepseek/types';

type MathJaxGlobal = {
  loader?: {
    load?: string[];
  };
  startup?: {
    promise?: Promise<void>;
    typeset?: boolean;
    input?: string[];
    output?: string;
    ready?: () => void;
    defaultReady?: () => void;
  };
  options?: {
    enableEnrichment?: boolean;
    enableSpeech?: boolean;
    enableBraille?: boolean;
    enableExplorer?: boolean;
    enableComplexity?: boolean;
    enableAssistiveMml?: boolean;
    menuOptions?: {
      settings?: {
        enrich?: boolean;
        collapsible?: boolean;
        speech?: boolean;
        braille?: boolean;
        assistiveMml?: boolean;
      };
    };
    a11y?: {
      speech?: boolean;
      braille?: boolean;
      subtitles?: boolean;
      viewBraille?: boolean;
      voicing?: boolean;
      keyMagnifier?: boolean;
      mouseMagnifier?: boolean;
      hover?: boolean;
      flame?: boolean;
      treeColoring?: boolean;
      infoType?: boolean;
      infoRole?: boolean;
      infoPrefix?: boolean;
    };
    worker?: {
      path?: string;
      pool?: string;
      worker?: string;
    };
  };
  tex2svgPromise?: (
    latex: string,
    options: { display: boolean },
  ) => Promise<HTMLElement | SVGElement>;
};

declare global {
  interface Window {
    MathJax?: MathJaxGlobal;
  }
}

const log = logger.child('FormulaImageRenderer');
const RASTER_EXPORT_SCALE = 4;
const RASTER_EXPORT_PADDING_PX = 8;
const JPEG_QUALITY = 0.98;
let mathJaxPromise: Promise<MathJaxGlobal> | null = null;

export type FormulaImageFormat = 'svg' | 'png' | 'jpg';

export async function renderFormulaSvg(formula: DeepSeekFormula): Promise<Blob> {
  const { svg } = await renderFormulaSvgMarkup(formula);
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

export async function renderFormulaRaster(
  formula: DeepSeekFormula,
  format: Exclude<FormulaImageFormat, 'svg'>,
): Promise<Blob> {
  const rendered = await renderFormulaSvgMarkup(formula);
  const svgBlob = new Blob([rendered.svg], { type: 'image/svg+xml;charset=utf-8' });
  return svgToRasterBlob(svgBlob, rendered.width, rendered.height, format);
}

async function renderFormulaSvgMarkup(
  formula: DeepSeekFormula,
): Promise<{ svg: string; width: number; height: number }> {
  log.debug('Rendering formula image', { display: formula.display, latexLength: formula.latex.length });
  const mathJax = await ensureMathJax();
  if (!mathJax.tex2svgPromise) throw new Error('MathJax SVG renderer is unavailable');

  const node = await mathJax.tex2svgPromise(formula.latex, { display: formula.display });
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:fixed;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none;';
  wrapper.appendChild(node);
  document.body.appendChild(wrapper);

  try {
    const svg = wrapper.querySelector('svg');
    if (!svg) throw new Error('MathJax did not produce an SVG element');

    const rect = svg.getBoundingClientRect();
    const fallback = getSvgViewBoxSize(svg);
    const width = Math.max(1, Math.ceil(rect.width || fallback.width));
    const height = Math.max(1, Math.ceil(rect.height || fallback.height));
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));

    return {
      svg: new XMLSerializer().serializeToString(clone),
      width,
      height,
    };
  } finally {
    wrapper.remove();
  }
}

async function ensureMathJax(): Promise<MathJaxGlobal> {
  if (window.MathJax?.tex2svgPromise) return window.MathJax;
  if (mathJaxPromise) return mathJaxPromise;

  window.MathJax = {
    loader: {
      load: [],
    },
    startup: {
      typeset: false,
      input: ['tex'],
      output: 'svg',
      ready: () => undefined,
    },
    options: {
      menuOptions: {
        settings: {
          enrich: false,
          collapsible: false,
          speech: false,
          braille: false,
          assistiveMml: false,
        },
      },
      enableEnrichment: false,
      enableSpeech: false,
      enableBraille: false,
      enableExplorer: false,
      enableComplexity: false,
      enableAssistiveMml: false,
      a11y: {
        speech: false,
        braille: false,
        subtitles: false,
        viewBraille: false,
        voicing: false,
        keyMagnifier: false,
        mouseMagnifier: false,
        hover: false,
        flame: false,
        treeColoring: false,
        infoType: false,
        infoRole: false,
        infoPrefix: false,
      },
      worker: {
        path: '',
        pool: '',
        worker: '',
      },
    },
  };

  mathJaxPromise = import('mathjax/es5/startup.js')
    .then(async () => {
      await import('mathjax/es5/core.js');
      await import('mathjax/es5/input/tex.js');
      await import('mathjax/es5/output/svg.js');
      await import('@mathjax/mathjax-newcm-font/svg.js');
      window.MathJax?.startup?.defaultReady?.();
    })
    .then(async () => {
      if (window.MathJax?.startup?.promise) await window.MathJax.startup.promise;
      if (!window.MathJax?.tex2svgPromise) {
        throw new Error('MathJax failed to initialize');
      }
      log.debug('MathJax SVG renderer initialized');
      return window.MathJax;
    })
    .catch((error) => {
      mathJaxPromise = null;
      log.error('MathJax SVG renderer initialization failed', { error });
      throw error;
    });

  return mathJaxPromise;
}

function getSvgViewBoxSize(svg: SVGElement): { width: number; height: number } {
  const viewBox = svg.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
    return {
      width: Math.ceil(Math.abs(viewBox[2] ?? 0) / 60),
      height: Math.ceil(Math.abs(viewBox[3] ?? 0) / 60),
    };
  }

  return { width: 320, height: 120 };
}

function svgToRasterBlob(
  svgBlob: Blob,
  width: number,
  height: number,
  format: Exclude<FormulaImageFormat, 'svg'>,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);

      const scale = Math.max(RASTER_EXPORT_SCALE, (window.devicePixelRatio || 1) * 2);
      const paddedWidth = width + RASTER_EXPORT_PADDING_PX * 2;
      const paddedHeight = height + RASTER_EXPORT_PADDING_PX * 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(paddedWidth * scale);
      canvas.height = Math.ceil(paddedHeight * scale);

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas 2D context is unavailable'));
        return;
      }

      context.scale(scale, scale);
      if (format === 'jpg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, paddedWidth, paddedHeight);
      }
      context.drawImage(image, RASTER_EXPORT_PADDING_PX, RASTER_EXPORT_PADDING_PX, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Formula image conversion failed'));
        },
        format === 'png' ? 'image/png' : 'image/jpeg',
        JPEG_QUALITY,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Formula SVG image failed to load'));
    };
    image.src = url;
  });
}
