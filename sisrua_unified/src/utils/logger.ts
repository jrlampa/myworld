type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: unknown;
}

// Check if we're in development mode
const isDevelopment = () => {
  try {
    return !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  } catch {
    return true; // Default to development if we can't determine
  }
};

class Logger {
  private static logs: LogEntry[] = [];
  private static maxLogs = 100;

  private static log(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data
    };

    this.logs.push(entry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output in development only
    if (isDevelopment()) {
      const prefix = `[${entry.timestamp.toISOString()}] [${level.toUpperCase()}]`;
      const logFn = level === 'error' ? console.error : 
                    level === 'warn' ? console.warn : 
                    console.log;
      
      if (data !== undefined) {
        logFn(prefix, message, data);
      } else {
        logFn(prefix, message);
      }
    }
  }

  static info(message: string, data?: unknown) {
    this.log('info', message, data);
  }

  static warn(message: string, data?: unknown) {
    this.log('warn', message, data);
  }

  static error(message: string, data?: unknown) {
    this.log('error', message, data);
  }

  static debug(message: string, data?: unknown) {
    if (isDevelopment()) {
      this.log('debug', message, data);
    }
  }

  static getLogs(): readonly LogEntry[] {
    return [...this.logs];
  }

  static clearLogs() {
    this.logs = [];
  }

  static getLogsByLevel(level: LogLevel): readonly LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export default Logger;
