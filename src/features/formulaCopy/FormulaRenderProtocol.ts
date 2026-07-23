export const FORMULA_RENDER_MESSAGE = 'dse.formula.render';

export type FormulaRenderFormat = 'svg' | 'png' | 'jpg';

export type FormulaRenderRequest = {
  type: typeof FORMULA_RENDER_MESSAGE;
  latex: string;
  display: boolean;
  format: FormulaRenderFormat;
};

export type FormulaRenderResponse =
  | { ok: true; blob: Blob }
  | { ok: false; error: string };

export function isFormulaRenderRequest(input: unknown): input is FormulaRenderRequest {
  if (!input || typeof input !== 'object') return false;
  const request = input as Partial<FormulaRenderRequest>;
  return (
    request.type === FORMULA_RENDER_MESSAGE &&
    typeof request.latex === 'string' &&
    request.latex.length > 0 &&
    typeof request.display === 'boolean' &&
    (request.format === 'svg' || request.format === 'png' || request.format === 'jpg')
  );
}
