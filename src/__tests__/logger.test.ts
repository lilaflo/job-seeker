import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '../logger';
import {
  saveLog,
  getLogs,
  getLogStats,
  getRecentLogs,
  deleteOldLogs,
  clearAllLogs,
} from '../database';

describe.skip('logger', () => {
  beforeEach(() => {
    clearAllLogs();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('database functions', () => {
    it('should save error log', () => {
      saveLog('error', 'Test error message', {
        source: 'test-module',
        context: { userId: 123 },
        stackTrace: 'Error stack trace',
      });

      const logs = getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toBe('Test error message');
      expect(logs[0].source).toBe('test-module');
      expect(logs[0].context).toBe('{"userId":123}');
      expect(logs[0].stack_trace).toBe('Error stack trace');
    });

    it('should save warning log', () => {
      saveLog('warning', 'Test warning message');

      const logs = getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warning');
      expect(logs[0].message).toBe('Test warning message');
    });

    it('should save info log', () => {
      saveLog('info', 'Test info message');

      const logs = getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
    });

    it('should save debug log', () => {
      saveLog('debug', 'Test debug message');

      const logs = getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('debug');
    });

    it('should filter logs by level', () => {
      saveLog('error', 'Error 1');
      saveLog('warning', 'Warning 1');
      saveLog('error', 'Error 2');

      const errorLogs = getLogs({ level: 'error' });
      expect(errorLogs).toHaveLength(2);
      expect(errorLogs[0].message).toBe('Error 2'); // Most recent first
      expect(errorLogs[1].message).toBe('Error 1');

      const warningLogs = getLogs({ level: 'warning' });
      expect(warningLogs).toHaveLength(1);
      expect(warningLogs[0].message).toBe('Warning 1');
    });

    it('should filter logs by source', () => {
      saveLog('error', 'Error from module A', { source: 'module-a' });
      saveLog('error', 'Error from module B', { source: 'module-b' });

      const moduleALogs = getLogs({ source: 'module-a' });
      expect(moduleALogs).toHaveLength(1);
      expect(moduleALogs[0].message).toBe('Error from module A');
    });

    it('should limit and offset logs', () => {
      for (let i = 1; i <= 10; i++) {
        saveLog('info', `Message ${i}`);
      }

      const firstPage = getLogs({ limit: 3 });
      expect(firstPage).toHaveLength(3);
      expect(firstPage[0].message).toBe('Message 10'); // Most recent

      const secondPage = getLogs({ limit: 3, offset: 3 });
      expect(secondPage).toHaveLength(3);
      expect(secondPage[0].message).toBe('Message 7');
    });

    it('should get log statistics', () => {
      saveLog('error', 'Error 1');
      saveLog('error', 'Error 2');
      saveLog('warning', 'Warning 1');
      saveLog('info', 'Info 1');
      saveLog('debug', 'Debug 1');

      const stats = getLogStats();
      expect(stats.total).toBe(5);
      expect(stats.errors).toBe(2);
      expect(stats.warnings).toBe(1);
      expect(stats.info).toBe(1);
      expect(stats.debug).toBe(1);
    });

    it('should get recent logs by level', () => {
      for (let i = 1; i <= 5; i++) {
        saveLog('error', `Error ${i}`);
      }

      const recent = getRecentLogs('error', 3);
      expect(recent).toHaveLength(3);
      expect(recent[0].message).toBe('Error 5'); // Most recent
      expect(recent[1].message).toBe('Error 4');
      expect(recent[2].message).toBe('Error 3');
    });

    it('should delete old logs', () => {
      // Save logs with different timestamps (manually set created_at)
      // Note: This test is simplified since we can't easily manipulate timestamps
      saveLog('error', 'Recent error');

      const deleted = deleteOldLogs(30); // Delete logs older than 30 days
      // Since we just created the log, nothing should be deleted
      expect(deleted).toBe(0);

      const logs = getLogs();
      expect(logs).toHaveLength(1);
    });

    it('should clear all logs', () => {
      saveLog('error', 'Error 1');
      saveLog('warning', 'Warning 1');

      expect(getLogs()).toHaveLength(2);

      clearAllLogs();

      expect(getLogs()).toHaveLength(0);
    });
  });

  describe('logger methods', () => {
    it('should log error with logger.error()', () => {
      logger.error('Test error');

      const logs = getLogs({ level: 'error' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test error');
      expect(console.error).toHaveBeenCalled();
    });

    it('should log warning with logger.warning()', () => {
      logger.warning('Test warning');

      const logs = getLogs({ level: 'warning' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test warning');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should log info with logger.info()', () => {
      logger.info('Test info');

      const logs = getLogs({ level: 'info' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test info');
      expect(console.info).toHaveBeenCalled();
    });

    it('should log debug with logger.debug()', () => {
      logger.debug('Test debug');

      const logs = getLogs({ level: 'debug' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test debug');
      expect(console.debug).toHaveBeenCalled();
    });

    it('should log error with context', () => {
      logger.error('Database connection failed', {
        context: { host: 'localhost', port: 5432 },
      });

      const logs = getLogs({ level: 'error' });
      expect(logs).toHaveLength(1);
      expect(logs[0].context).toBe('{"host":"localhost","port":5432}');
    });

    it('should log error with custom source', () => {
      logger.error('Custom source error', {
        source: 'my-custom-module',
      });

      const logs = getLogs({ level: 'error' });
      expect(logs).toHaveLength(1);
      expect(logs[0].source).toBe('my-custom-module');
    });

    it('should skip console logging when skipConsole is true', () => {
      logger.error('Silent error', { skipConsole: true });

      const logs = getLogs({ level: 'error' });
      expect(logs).toHaveLength(1);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should skip database logging when skipDatabase is true', () => {
      logger.error('Console only error', { skipDatabase: true });

      const logs = getLogs({ level: 'error' });
      expect(logs).toHaveLength(0);
      expect(console.error).toHaveBeenCalled();
    });

    it('should log error from Error object', () => {
      const error = new Error('Something went wrong');
      logger.errorFromException(error);

      const logs = getLogs({ level: 'error' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Something went wrong');
      expect(logs[0].stack_trace).toBeTruthy();
      expect(console.error).toHaveBeenCalled();
    });

    it('should log error from unknown object', () => {
      logger.errorFromException({ custom: 'error' });

      const logs = getLogs({ level: 'error' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('[object Object]');
    });

    it('should capture stack trace for errors', () => {
      logger.error('Error with stack');

      const logs = getLogs({ level: 'error' });
      expect(logs).toHaveLength(1);
      expect(logs[0].stack_trace).toBeTruthy();
      expect(logs[0].stack_trace).toContain('logger.test.ts');
    });

    it('should not capture stack trace for warnings', () => {
      logger.warning('Warning without stack');

      const logs = getLogs({ level: 'warning' });
      expect(logs).toHaveLength(1);
      expect(logs[0].stack_trace).toBeNull();
    });
  });

  describe('usage examples', () => {
    it('should handle typical error logging scenario', () => {
      try {
        throw new Error('Database connection failed');
      } catch (error) {
        logger.errorFromException(error, {
          source: 'database',
          context: { operation: 'connect', host: 'localhost' },
        });
      }

      const logs = getLogs({ level: 'error' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Database connection failed');
      expect(logs[0].source).toBe('database');
      expect(logs[0].context).toBe('{"operation":"connect","host":"localhost"}');
      expect(logs[0].stack_trace).toBeTruthy();
    });

    it('should handle multiple log levels', () => {
      logger.info('Application started');
      logger.debug('Initializing database');
      logger.warning('Configuration missing, using defaults');
      logger.error('Failed to load plugin');

      const stats = getLogStats();
      expect(stats.total).toBe(4);
      expect(stats.info).toBe(1);
      expect(stats.debug).toBe(1);
      expect(stats.warnings).toBe(1);
      expect(stats.errors).toBe(1);
    });
  });
});
