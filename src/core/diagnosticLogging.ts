import { getSettings } from './settings';
import { setDiagnosticLoggingEnabled } from './logger';
import { onStorageChanged } from './storage';
import { SETTINGS_KEY, normalizeSettings } from './settings';

let initialized = false;

export function initializeDiagnosticLogging(): void {
  if (initialized) return;
  initialized = true;

  void getSettings().then((settings) => setDiagnosticLoggingEnabled(settings.diagnosticLoggingEnabled));
  onStorageChanged((changes, area) => {
    if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
    setDiagnosticLoggingEnabled(
      normalizeSettings(changes[SETTINGS_KEY].newValue as Record<string, unknown> | undefined)
        .diagnosticLoggingEnabled,
    );
  });
}
