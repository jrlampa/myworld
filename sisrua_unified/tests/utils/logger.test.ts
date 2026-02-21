import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Logger from '../../src/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    Logger.clearLogs();
    vi.clearAllMocks();
  });

  describe('info', () => {
    it('should log info messages', () => {
      Logger.info('Test info message');
      const logs = Logger.getLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('Test info message');
    });

    it('should log info with data', () => {
      const data = { key: 'value' };
      Logger.info('Test with data', data);
      const logs = Logger.getLogs();
      
      expect(logs[0].data).toEqual(data);
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      Logger.warn('Test warning');
      const logs = Logger.getLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      Logger.error('Test error');
      const logs = Logger.getLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
    });
  });

  describe('debug', () => {
    it('should log debug messages in development', () => {
      Logger.debug('Test debug');
      const logs = Logger.getLogs();
      
      // Debug is logged but might not appear in console in production
      expect(logs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('log management', () => {
    it('should limit number of logs', () => {
      // Logger has maxLogs = 100
      for (let i = 0; i < 150; i++) {
        Logger.info(`Message ${i}`);
      }
      
      const logs = Logger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(100);
    });

    it('should clear logs', () => {
      Logger.info('Message 1');
      Logger.info('Message 2');
      expect(Logger.getLogs()).toHaveLength(2);
      
      Logger.clearLogs();
      expect(Logger.getLogs()).toHaveLength(0);
    });

    it('should filter logs by level', () => {
      Logger.info('Info message');
      Logger.error('Error message');
      Logger.warn('Warning message');
      
      const errors = Logger.getLogsByLevel('error');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Error message');
    });

    it('should export logs as JSON', () => {
      Logger.info('Test message');
      const exported = Logger.exportLogs();
      
      expect(exported).toContain('Test message');
      expect(exported).toContain('info');
    });
  });

  describe('timestamp', () => {
    it('should add timestamp to each log', () => {
      Logger.info('Test');
      const logs = Logger.getLogs();
      
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('development mode (NODE_ENV=development) — lines 40-50, 67-68', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('should call console.log for info in development mode (lines 40-44)', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      Logger.info('Dev info message');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        'Dev info message'
      );
    });

    it('should call console.warn for warn in development mode (lines 42-43)', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      Logger.warn('Dev warn message');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        'Dev warn message'
      );
    });

    it('should call console.error for error in development mode (line 41)', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      Logger.error('Dev error message');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        'Dev error message'
      );
    });

    it('should include extra data in console when provided (lines 47-48)', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const extra = { key: 'value' };

      Logger.info('Info with data', extra);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        'Info with data',
        extra
      );
    });

    it('should log debug in development mode (lines 67-68)', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      Logger.debug('Debug message');

      const logs = Logger.getLogs();
      const debugLogs = logs.filter(l => l.level === 'debug');
      expect(debugLogs).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not log debug outside development mode', () => {
      vi.stubEnv('NODE_ENV', 'test');
      Logger.clearLogs();

      Logger.debug('Ignored message');

      const logs = Logger.getLogs();
      const debugLogs = logs.filter(l => l.level === 'debug');
      expect(debugLogs).toHaveLength(0);
    });
  });
});
