import type { LogContext, LogLevel } from './logger';

export const DIAGNOSTIC_LOG_MESSAGE_TYPE = 'dse.diagnostic-log.command';
export const DIAGNOSTIC_LOG_FORMAT = 'deepseek-enhancer.logs.v1';

export type DiagnosticLogRecord = {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  context?: LogContext;
};

export type DiagnosticLogExport = {
  format: typeof DIAGNOSTIC_LOG_FORMAT;
  exportedAt: string;
  logs: DiagnosticLogRecord[];
};
