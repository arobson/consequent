require('../setup')
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

const actorAdapter = {
  fetch: _.noop,
  findAncestor: _.noop,
  store: _.noop
}

const eventAdapter = {
  fetch: _.noop,
  storePack: _.noop
}

const applySpy = sinon.spy(function (a, q, t, e, x) {
  x.applied = x.applied || []
  x.applied.push(e)
  return Promise.resolve()
})

const managerFn = proxyquire('../src/manager', {
  './apply': applySpy
})

describe('Manager', () => {
  let actors
  before(() => {
    return loader(fount, './spec/actors')
      .then((list) => {
        actors = list
        return flakes.seedFromEnvironment()
      })
  })
  describe('when actor fetch fails', () => {
    let actorMock
    let manager
    before(() => {
      actorMock = sinon.mock(actorAdapter)
      actorMock.expects('fetch')
        .withArgs('account', 100)
        .rejects(new Error('Nope sauce'))
      manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue())
    })

    it('should reject with an error', () =>
      manager.getOrCreate('account', 100)
        .should.be.rejectedWith('Nope sauce')
    )

    it('should call fetch on actor adapter', () => {
      actorMock.verify()
    })
  })

  describe('when single actor instance exists', () => {
    let actorMock
    let eventMock
    let manager
    let actor
    let state
    let events
    const id100 = flakes.create()
    before(() => {
      state = {
        _lastEventId: 1,
        _id: id100,
        id: 100
      }
      actor = {
        type: 'account'
      }
      events = [ { id: 2 }, { id: 3 } ]
      const instance = {
        actor: actor,
        state: state
      }
      actorMock = sinon.mock(actorAdapter)
      actorMock.expects('fetch')
        .withArgs('account', 100)
        .resolves(instance)
      actorMock.expects('store').never()
      eventMock = sinon.mock(eventAdapter)
      eventMock.expects('fetch')
        .withArgs('account', id100, 1)
        .resolves(events)
      eventMock.expects('storePack').never()

      manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue())
    })

    it('should result in updated actor', () =>
      manager.getOrCreate('account', 100)
        .should.eventually.eql({
          state: state,
          actor: actor,
          applied: events
        })
    )

    it('should call fetch on actor adapter', () => {
      actorMock.verify()
    })

    it('should call fetch on event adapter', () => {
      eventMock.verify()
    })
  })

  describe('when multiple actor instances exist', () => {
    let actorMock
    let eventMock
    let manager
    let instances
    let actor
    let state
    let events
    const id100 = flakes.create()
    before(() => {
      actor = { type: 'account' }
      instances = [
        {
          actor: actor,
          state: {
            _lastEventId: 4,
            _id: id100,
            id: 100
          }
        },
        {
          actor: actor,
          state: {
            _lastEventId: 5,
            _id: id100,
            id: 100
          }
        }
      ]
      state = {
        _lastEventId: 1,
        _id: id100,
        id: 100
      }
      events = [ { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 } ]
      var instance = {
        actor: actor,
        state: state
      }
      actorMock = sinon.mock(actorAdapter)
      actorMock.expects('fetch')
        .withArgs('account', 100)
        .resolves(instances)
      actorMock.expects('findAncestor')
        .withArgs(id100, instances, [])
        .resolves(instance)
      actorMock.expects('store').never()
      eventMock = sinon.mock(eventAdapter)
      eventMock.expects('fetch')
        .withArgs('account', id100, 1)
        .resolves(events)
      eventMock.expects('storePack').never()

      manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue())
    })

    it('should result in updated actor', () =>
      manager.getOrCreate('account', 100)
        .should.eventually.eql({
          actor: actor,
          state: state,
          applied: events
        })
    )

    it('should call fetch on actor adapter', () => {
      actorMock.verify()
    })

    it('should call fetch on event adapter', () => {
      eventMock.verify()
    })
  })

  describe('when event threshold is exceeded', () => {
    describe('in normal mode', () => {
      let actorMock
      let eventMock
      let manager
      let actor
      let state
      let events
      const id100 = flakes.create()
      before(() => {
        actor = {
          type: 'account',
          storeEventPack: true,
          eventThreshold: 2
        }
        state = {
          _lastEventId: 1,
          id: 100,
          _id: id100
        }
        events = [ { id: 2 }, { id: 3 } ]
        var instance = {
          actor: actor,
          state: state
        }
        actorMock = sinon.mock(actorAdapter)
        actorMock.expects('fetch')
          .withArgs('account', 100)
          .resolves(instance)
        actorMock.expects('store')
          .withArgs(instance)
          .once()
          .resolves({})
        eventMock = sinon.mock(eventAdapter)
        eventMock.expects('fetch')
          .withArgs('account', id100, 1)
          .resolves(events)
        eventMock.expects('storePack')
          .withArgs('account', state._id, undefined, 1, events)
          .once()
          .resolves()

        manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue())
      })

      it('should result in updated actor', () =>
        manager.getOrCreate('account', 100)
          .should.eventually.eql({
            actor: actor,
            state: state,
            applied: events
          })
      )

      it('should call fetch on actor adapter', () => {
        actorMock.verify()
      })

      it('should call fetch on event adapter', () => {
        eventMock.verify()
      })
    })

    describe('in readOnly without snapshotOnRead', () => {
      let actorMock
      let eventMock
      let manager
      let actor
      let state
      let events
      const id100 = flakes.create()
      before(() => {
        actor = {
          type: 'account',
          eventThreshold: 2
        }
        state = {
          _lastEventId: 1,
          _id: id100,
          id: 100
        }
        events = [ { id: 2 }, { id: 3 } ]
        var instance = {
          actor: actor,
          state: state
        }
        actorMock = sinon.mock(actorAdapter)
        actorMock.expects('fetch')
          .withArgs('account', 100)
          .resolves(instance)
        actorMock.expects('store').never()
        eventMock = sinon.mock(eventAdapter)
        eventMock.expects('fetch')
          .withArgs('account', id100, 1)
          .resolves(events)
        eventMock.expects('storePack').never()

        manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue())
      })

      it('should result in updated actor', () =>
        manager.getOrCreate('account', 100, true)
          .should.eventually.eql({
            actor: actor,
            state: state,
            applied: events
          })
      )

      it('should call fetch on actor adapter', () => {
        actorMock.verify()
      })

      it('should call fetch on event adapter', () => {
        eventMock.verify()
      })
    })

    describe('in readOnly with snapshotOnRead', () => {
      let actorMock
      let eventMock
      let manager
      let actor
      let state
      let events
      const id100 = flakes.create()
      before(() => {
        actor = {
          type: 'account',
          eventThreshold: 2,
          storeEventPack: true,
          snapshotOnRead: true
        }
        state = {
          _lastEventId: 1,
          _id: id100,
          id: 100
        }
        events = [ { id: 2 }, { id: 3 } ]
        var instance = {
          actor: actor,
          state: state
        }
        actorMock = sinon.mock(actorAdapter)
        actorMock.expects('fetch')
          .withArgs('account', 100)
          .resolves(instance)
        actorMock.expects('store')
          .withArgs(instance)
          .once()
          .resolves({})
        eventMock = sinon.mock(eventAdapter)
        eventMock.expects('fetch')
          .withArgs('account', id100, 1)
          .resolves(events)
        eventMock.expects('storePack')
          .withArgs('account', state._id, undefined, 1, events)
          .once()
          .resolves()

        manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue())
      })

      it('should result in updated actor', () =>
        manager.getOrCreate('account', 100, true)
          .should.eventually.eql({
            actor: actor,
            state: state,
            applied: events
          })
      )

      it('should call fetch on actor adapter', () => {
        actorMock.verify()
      })

      it('should call fetch on event adapter', () => {
        eventMock.verify()
      })
    })

    describe('with aggregateFrom', () => {
      let actorMock
      let eventMock
      let manager
      let actor
      let state
      let events
      const id100 = flakes.create()
      before(() => {
        actor = {
          type: 'account',
          eventThreshold: 2
        }
        state = {
          _lastEventId: 1,
          _id: id100,
          id: 100
        }
        events = [ { id: 2 }, { id: 3 } ]
        var instance = {
          actor: actor,
          state: state
        }
        actorMock = sinon.mock(actorAdapter)
        actorMock.expects('fetch')
          .withArgs('account', 100)
          .resolves(instance)
        actorMock.expects('store').never()
        eventMock = sinon.mock(eventAdapter)
        eventMock.expects('fetch')
          .withArgs('account', id100, 1)
          .resolves(events)
        eventMock.expects('storePack').never()

        manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue())
      })

      it('should result in updated actor', () =>
        manager.getOrCreate('account', 100, true)
          .should.eventually.eql({
            actor: actor,
            state: state,
            applied: events
          })
      )

      it('should call fetch on actor adapter', () => {
        actorMock.verify()
      })

      it('should call fetch on event adapter', () => {
        eventMock.verify()
      })
    })
  })
})
