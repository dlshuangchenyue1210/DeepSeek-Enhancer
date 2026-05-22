import { queryFirst, selectors } from './selectors';

export function getInput(): HTMLElement | null {
  return queryFirst(document, selectors.inputCandidates);
}
