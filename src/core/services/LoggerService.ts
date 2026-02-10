/**
 * Structured logging service for Claude Voyager.
 * All log output is prefixed with [Voyager] for easy filtering in devtools.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_PREFIX = '[Voyager]';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class LoggerServiceImpl {
  private minLevel: LogLevel = 'info';

  /** Set the minimum log level. Messages below this level are suppressed. */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /** Log a debug message */
  debug(tag: string, message: string, ...data: unknown[]): void {
    this.log('debug', tag, message, ...data);
  }

  /** Log an info message */
  info(tag: string, message: string, ...data: unknown[]): void {
    this.log('info', tag, message, ...data);
  }

  /** Log a warning */
  warn(tag: string, message: string, ...data: unknown[]): void {
    this.log('warn', tag, message, ...data);
  }

  /** Log an error */
  error(tag: string, message: string, ...data: unknown[]): void {
    this.log('error', tag, message, ...data);
  }

  private log(level: LogLevel, tag: string, message: string, ...data: unknown[]): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix = `${LOG_PREFIX}[${timestamp}][${tag}]`;

    switch (level) {
      case 'debug':
        console.debug(prefix, message, ...data);
        break;
      case 'info':
        console.info(prefix, message, ...data);
        break;
      case 'warn':
        console.warn(prefix, message, ...data);
        break;
      case 'error':
        console.error(prefix, message, ...data);
        break;
    }
  }
}

/** Singleton logger instance */
export const Logger = new LoggerServiceImpl();
