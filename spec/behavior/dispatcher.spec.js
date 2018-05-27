require('../setup')
const dispatcherFn = require('../../src/dispatch')
const loader = require('../../src/loader')
const fount = require('fount')
const flakes = require('node-flakes')()

function mockQueue (id, fn) {
  const queue = { add: () => {} }
  const mock = sinon.mock(queue)
  if (id) {
    mock
      .expects('add')
      .once()
      .withArgs(id, sinon.match.func)
      .resolves(fn())
  } else {
    mock
      .expects('add')
      .never()
  }
  queue.restore = mock.restore
  return queue
}

function mockManager (type, id, result, calls) {
  const manager = { getOrCreate: () => {}, storeEvents: _.noop }
  const mock = sinon.mock(manager)
  if (type) {
    const expectation = mock
      .expects('getOrCreate')
      .exactly(calls || 1)
      .withArgs(type, id)
    if (result.name) {
      expectation.rejects(result)
    } else {
      expectation.resolves(result)
    }
  } else {
    mock
      .expects('getOrCreate')
      .never()
  }
  manager.restore = mock.restore
  return manager
}

function mockSearch (type, fields, results, err) {
  const search = { update: () => {} }
  const mock = sinon.mock(search)
  if (results) {
    results.forEach(result => {
      const expectation = mock
        .expects('update')
        .withArgs(type, fields)
      if (err) {
        expectation.rejectedWith(err)
      } else {
        expectation.resolves()
      }
    })
  } else {
    const expectation = mock
        .expects('update')
        .never()
  }
  search.verify = mock.verify
  search.restore = mock.restore
  return search
}

describe('Dispatch', () => {
  describe('when dispatching unmatched topic', function () {
    var queue
    var lookup
    var manager
    var dispatcher
    var search

    before(() => {
      queue = mockQueue()
      manager = mockManager()
      lookup = {}
      search = mockSearch('', [], null)
      dispatcher = dispatcherFn(flakes, lookup, manager, search, {}, queue)
      return flakes.seedFromEnvironment()
    })

    it('should not queue a task', () =>
      dispatcher.handle('badid', 'nomatch', {})
        .should.eventually.eql([])
    )

    after(() => {
      search.restore()
      queue.restore()
      manager.restore()
    })
  })

  describe('dispatching with manager error', function () {
    var queue
    var lookup
    var manager
    var dispatcher
    var search

    before(() => {
      const actors = {
        test: {
          metadata: {
            actor: {
              type: 'test'
            },
            commands: {
              doAThing: [ [] ]
            }
          }
        }
      }
      queue = mockQueue()
      manager = mockManager('test', 100, new Error(':('))
      lookup = { doAThing: [ 'test' ] }
      search = mockSearch('', [], null)
      dispatcher = dispatcherFn(flakes, lookup, manager, search, actors, queue)
    })

    it('should not queue a task', () =>
      dispatcher.handle(100, 'doAThing', {})
        .should.be.rejectedWith(`Failed to instantiate actor 'test'`)
    )

    after(() => {
      search.restore()
      queue.restore()
      manager.restore()
    })
  })

  describe('dispatching to existing actor', function () {
    var queue
    var lookup
    var manager
    var dispatcher
    var actors
    var instance
    var command
    var event
    var results
    var search

    before(function () {
      command = { type: 'test.doAThing', thing: { howMuch: 'totes mcgoats' } }
      event = { type: 'test.thingDid', did: { degree: 'totes mcgoats' } }
      const metadata = {
        test: {
          actor: {
            type: 'test',
            searchableBy: ['doneDidfulness'],
            identifiedBy: 'id'
          },
          state: {

          },
          commands: {
            doAThing: [
              [
                (actor) => actor.canDo,
                (actor, thing) => [ { type: 'test.thingDid', did: { degree: thing.howMuch } } ]
              ]
            ]
          },
          events: {
            thingDid: [
              [ true, (actor, did) => {
                actor.doneDidfulness = did.degree
              } ]
            ]
          }
        }
      }
      queue = {
        add: (id, fn) => Promise.resolve(fn())
      }
      results = [
        {
          actor: {
            type: 'test',
            searchableBy: ['doneDidfulness']
          },
          original: {},
          state: {
            doneDidfulness: 'totes mcgoats'
          },
          events: [
            {
              _actorType: 'test',
              _initiatedBy: 'test.doAThing',
              type: 'test.thingDid',
              did: {
                degree: 'totes mcgoats'
              }
            }
          ],
          message: command
        }
      ]

      loader(fount, metadata)
        .then(function (list) {
          actors = list
          instance = _.clone(actors.test.metadata)
          instance.state = { id: 100, canDo: true }
          manager = mockManager('test', 100, instance, 2)
          lookup = {
            'test.doAThing': [ 'test' ],
            'test.thingDid': [ 'test' ]
          }

          search = mockSearch('test', ['doneDidfulness'], results)
          dispatcher = dispatcherFn(flakes, lookup, manager, search, actors, queue)
        })
    })

    it('should queue the command successfully', function () {
      return dispatcher.handle(100, 'test.doAThing', command)
        .should.eventually.partiallyEql(results)
    })

    it('should queue the event successfully', function () {
      return dispatcher.handle(100, 'test.thingDid', event)
        .should.eventually.eql([])
    })

    it('should mutate actor state', function () {
      instance.state.doneDidfulness.should.eql('totes mcgoats')
    })

    after(function () {
      manager.restore()
    })
  })
})
