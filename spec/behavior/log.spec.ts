import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import logFn from '../../src/log.js'
import mockLog from '../mockLogger.js'

describe('Logging', () => {
  describe('before initialization', () => {
    let log: ReturnType<typeof logFn>
    beforeAll(() => {
      log = logFn('test') as ReturnType<typeof logFn>
    })

    it('should not throw exceptions', () => {
      expect(() => {
        (log as any).debug('one')
      }).not.toThrow()
      expect(() => {
        (log as any).info('two')
      }).not.toThrow()
      expect(() => {
        (log as any).warn('three')
      }).not.toThrow()
      expect(() => {
        (log as any).error('four')
      }).not.toThrow()
    })
  })

  describe('with debug env set', () => {
    const original = process.env.DEBUG
    let log: any
    beforeAll(() => {
      process.env.DEBUG = 'test'
      log = (logFn({
        level: 'silent',
        stream: mockLog('test')
      }) as any)('test')
      log.debug('hello')
      log.info('ignored')
      log.warn('ignored')
      log.error('ignored')
    })

    it('should not send log entries to other adapters', () => {
      expect((mockLog('test') as any).test).toEqual(undefined)
    })

    afterAll(() => {
      process.env.DEBUG = original
    })
  })

  describe('config overload with string', () => {
    it('should return a Logger', () => {
      const logger = logFn('test-string') as any
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })
  })

  describe('config overload with object', () => {
    it('should return a factory function (callable to create loggers)', () => {
      const mod = logFn({ level: 'silent', stream: mockLog('overload-test') }) as any
      expect(typeof mod).toBe('function')
      const logger = mod('overload-test')
      expect(typeof logger.debug).toBe('function')
    })
  })

  describe('debugOut stream write', () => {
    it('should exercise debug stream when module loaded with DEBUG set', async () => {
      const original = process.env.DEBUG
      process.env.DEBUG = 'consequent.*'
      vi.resetModules()
      const freshLog = (await import('../../src/log.js')).default
      const logger = freshLog('test-debug') as any
      expect(() => logger.debug('debug message')).not.toThrow()
      process.env.DEBUG = original
    })
  })

  describe('without debug', () => {
    const original = process.env.DEBUG
    let log: any
    let adapter: any
    beforeAll(() => {
      delete process.env.DEBUG
      adapter = mockLog('test')
      log = (logFn({
        level: 'warn',
        stream: adapter
      }) as any)('test')

      log.debug('debug')
      log.info('info')
      log.warn('warn')
      log.error('error')
    })

    it('should log entries to adapter', () => {
      const entries = adapter.namespaces['test'].entries
      expect(entries.warn).toContain('warn')
      expect(entries.error).toContain('error')
    })

    afterAll(() => {
      process.env.DEBUG = original
    })
  })
})
