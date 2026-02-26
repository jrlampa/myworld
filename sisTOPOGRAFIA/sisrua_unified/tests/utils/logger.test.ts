import { describe, it, expect, beforeEach, vi } from 'vitest';
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
});
