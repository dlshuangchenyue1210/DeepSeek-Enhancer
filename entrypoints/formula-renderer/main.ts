import { initializeDiagnosticLogging } from '@/src/core/diagnosticLogging';
import { logger } from '@/src/core/logger';
import { renderFormulaRaster, renderFormulaSvg } from '@/src/features/formulaCopy/FormulaImageRenderer';
import {
  isFormulaRenderRequest,
  type FormulaRenderResponse,
} from '@/src/features/formulaCopy/FormulaRenderProtocol';
import type { DeepSeekFormula } from '@/src/platform/deepseek/types';

const log = logger.child('FormulaRendererPage');

initializeDiagnosticLogging();

window.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (event.source !== window.parent || !port || !isFormulaRenderRequest(event.data)) return;

  const formula: DeepSeekFormula = {
    element: document.body,
    latex: event.data.latex,
    mathml: null,
    display: event.data.display,
  };
  const render =
    event.data.format === 'svg'
      ? renderFormulaSvg(formula)
      : renderFormulaRaster(formula, event.data.format);
  void render.then(
    (blob) => port.postMessage({ ok: true, blob } satisfies FormulaRenderResponse),
    (error) => {
      log.error('Formula render request failed', { error, format: event.data.format });
      port.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies FormulaRenderResponse);
    },
  );
});

log.info('Formula renderer page ready');
