require('../setup')
const logFn = require('../../src/log')
const mockLog = require('../mockLogger')('test')

describe('Logging', () => {
  describe('before initialization', () => {
    var log
    before(() => {
      log = logFn('test')
    })

    it('should not throw exceptions', () => {
      should.not.throw(() => {
        log.debug('one')
      })
      should.not.throw(() => {
        log.info('two')
      })
      should.not.throw(() => {
        log.warn('three')
      })
      should.not.throw(() => {
        log.error('four')
      })
    })
  })

  describe('with debug env set', () => {
    var original = process.env.DEBUG
    var log
    before(() => {
      process.env.DEBUG = 'test'
      log = logFn({
        level: 'none',
        stream: mockLog
      })('test')
      log.debug('hello')
      log.info('ignored')
      log.warn('ignored')
      log.error('ignored')
    })

    it('should not send log entries to other adapters', () => {
      expect(mockLog.test).to.equal(undefined)
    })

    after(() => {
      process.env.DEBUG = original
    })
  })

  describe('without debug', () => {
    var original = process.env.DEBUG
    var log
    before(() => {
      delete process.env.DEBUG
      log = logFn({
        level: 'warn',
        stream: mockLog
      })('test')

      log.debug('debug')
      log.info('info')
      log.warn('warn')
      log.error('error')
    })

    it('should log entries to adapter', () => {
      mockLog.namespaces[ 'test' ].entries.should.eql({
        error: [ 'error' ],
        warn: [ 'warn' ],
        info: [],
        debug: []
      })
    })

    after(() => {
      process.env.DEBUG = original
    })
  })
})
