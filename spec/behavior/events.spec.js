require('../setup')
const eventAdapterFn = require('../../src/events')

const store = {
  getEventsFor: _.noop,
  getEventPackFor: _.noop,
  storeEvents: _.noop,
  storeEventPack: _.noop
}

const cache = {
  getEventsFor: _.noop,
  getEventPackFor: _.noop,
  storeEvents: _.noop,
  storeEventPack: _.noop
}

describe('Events', () => {
  var eventAdapter
  before(() => {
    eventAdapter = eventAdapterFn({}, {})
    eventAdapter.adapters.cache.account = Promise.resolve(cache)
    eventAdapter.adapters.store.account = Promise.resolve(store)
  })

  describe('when fetching events', () => {
    describe('and events are returned from cache', () => {
      var storeMock
      var cacheMock
      var events
      before(() => {
        events = [ { id: 3 }, { id: 1 }, { id: 2 } ]
        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('getEventsFor').never()
        cacheMock.expects('getEventsFor')
          .withArgs(10, 100)
          .resolves(events)
      })

      it('should return events', () =>
        eventAdapter.fetch('account', 10, 100)
          .should.eventually.eql([
            { id: 1 },
            { id: 2 },
            { id: 3 }
          ])
      )

      it('should call getEventsFor on cache', () => {
        cacheMock.verify()
      })

      it('should not call store', () => {
        storeMock.verify()
      })
    })

    describe('and cache returns an error', () => {
      var storeMock
      var cacheMock
      var events
      before(() => {
        events = [ { id: 3 }, { id: 1 }, { id: 2 } ]

        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('getEventsFor')
          .withArgs(10, 100)
          .resolves(events)
        cacheMock.expects('getEventsFor')
          .withArgs(10, 100)
          .rejects(new Error('bad cache'))
      })

      it('should return events', () =>
        eventAdapter.fetch('account', 10, 100, true)
          .should.eventually.eql([
            { id: 1 },
            { id: 2 },
            { id: 3 }
          ])
      )

      it('should call getEventsFor on cache', () => {
        cacheMock.verify()
      })

      it('should call getEventsFor on store', () => {
        storeMock.verify()
      })
    })

    describe('and no events are in cache', () => {
      describe('and events are returned from store', () => {
        var storeMock
        var cacheMock
        var events
        before(() => {
          events = [ { id: 3 }, { id: 1 }, { id: 2 } ]

          storeMock = sinon.mock(store)
          cacheMock = sinon.mock(cache)
          storeMock.expects('getEventsFor')
            .withArgs(10, 100)
            .resolves(events)
          cacheMock.expects('getEventsFor')
            .withArgs(10, 100)
            .resolves(undefined)
        })

        it('should return events', () =>
          eventAdapter.fetch('account', 10, 100)
            .should.eventually.eql([
              { id: 1 },
              { id: 2 },
              { id: 3 }
            ])
        )

        it('should call getEventsFor on cache', () => {
          cacheMock.verify()
        })

        it('should call getEventsFor on store', () => {
          storeMock.verify()
        })
      })

      describe('and store returns an error', () => {
        var storeMock
        var cacheMock
        before(() => {
          storeMock = sinon.mock(store)
          cacheMock = sinon.mock(cache)
          storeMock.expects('getEventsFor')
            .withArgs(10, 100)
            .rejects(new Error('store done blew up'))
          cacheMock.expects('getEventsFor')
            .withArgs(10, 100)
            .resolves(undefined)
        })

        it('should return events', () =>
          eventAdapter.fetch('account', 10, 100, true)
            .should.eventually.eql([])
        )

        it('should call getEventsFor on cache', () => {
          cacheMock.verify()
        })

        it('should call getEventsFor on store', () => {
          storeMock.verify()
        })
      })

      describe('and no events are in store', () => {
        var storeMock
        var cacheMock
        before(() => {
          storeMock = sinon.mock(store)
          cacheMock = sinon.mock(cache)
          storeMock.expects('getEventsFor')
            .withArgs(10, 100)
            .resolves(undefined)
          cacheMock.expects('getEventsFor')
            .withArgs(10, 100)
            .resolves(undefined)
        })

        it('should return events', () =>
          eventAdapter.fetch('account', 10, 100)
            .should.eventually.eql([])
        )

        it('should call getEventsFor on cache', () => {
          cacheMock.verify()
        })

        it('should call getEventsFor on store', () => {
          storeMock.verify()
        })
      })
    })
  })

  describe('when fetching eventpack', () => {
    describe('and eventpack is returned from cache', () => {
      var storeMock
      var cacheMock
      var events
      before(() => {
        events = [ { id: 3 }, { id: 1 }, { id: 2 } ]

        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('getEventPackFor').never()
        cacheMock.expects('getEventPackFor')
          .withArgs(10, 'a:1;b:2')
          .resolves(events)
      })

      it('should return events', () =>
        eventAdapter.fetchPack('account', 10, 'a:1;b:2')
          .should.eventually.eql([
            { id: 1 },
            { id: 2 },
            { id: 3 }
          ])
      )

      it('should call getEventsFor on cache', () => {
        cacheMock.verify()
      })

      it('should not call store', () => {
        storeMock.verify()
      })
    })

    describe('and cache returns an error', () => {
      var storeMock
      var cacheMock
      var events
      before(() => {
        events = [ { id: 3 }, { id: 1 }, { id: 2 } ]

        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('getEventPackFor')
          .withArgs(10, 'a:1;b:2')
          .resolves(events)
        cacheMock.expects('getEventPackFor')
          .withArgs(10, 'a:1;b:2')
          .rejects(new Error('I barfed'))
      })

      it('should return events', () =>
        eventAdapter.fetchPack('account', 10, 'a:1;b:2')
          .should.eventually.eql([
            { id: 1 },
            { id: 2 },
            { id: 3 }
          ])
      )

      it('should call getEventsFor on cache', () => {
        cacheMock.verify()
      })

      it('should call getEventsFor on store', () => {
        storeMock.verify()
      })
    })

    describe('and no eventpack is in cache', () => {
      describe('and eventpack is returned from store', () => {
        var storeMock
        var cacheMock
        var events
        before(() => {
          events = [ { id: 3 }, { id: 1 }, { id: 2 } ]

          storeMock = sinon.mock(store)
          cacheMock = sinon.mock(cache)
          storeMock.expects('getEventPackFor')
            .withArgs(10, 'a:1;b:2')
            .resolves(events)
          cacheMock.expects('getEventPackFor')
            .withArgs(10, 'a:1;b:2')
            .resolves(undefined)
        })

        it('should return events', () =>
          eventAdapter.fetchPack('account', 10, 'a:1;b:2')
            .should.eventually.eql([
              { id: 1 },
              { id: 2 },
              { id: 3 }
            ])
        )

        it('should call getEventsFor on cache', () => {
          cacheMock.verify()
        })

        it('should call getEventsFor on store', () => {
          storeMock.verify()
        })
      })

      describe('and no pack was in the store', () => {
        var storeMock
        var cacheMock
        before(() => {
          storeMock = sinon.mock(store)
          cacheMock = sinon.mock(cache)
          storeMock.expects('getEventPackFor')
            .withArgs(10, 'a:1;b:2')
            .resolves(undefined)
          cacheMock.expects('getEventPackFor')
            .withArgs(10, 'a:1;b:2')
            .resolves(undefined)
        })

        it('should return events', () =>
          eventAdapter.fetchPack('account', 10, 'a:1;b:2')
            .should.eventually.eql([])
        )

        it('should call getEventsFor on cache', () => {
          cacheMock.verify()
        })

        it('should call getEventsFor on store', () => {
          storeMock.verify()
        })
      })

      describe('and store returns an error', () => {
        var storeMock
        var cacheMock
        before(() => {
          storeMock = sinon.mock(store)
          cacheMock = sinon.mock(cache)
          storeMock.expects('getEventPackFor')
            .withArgs(10, 'a:1;b:2')
            .rejects(new Error('oops'))
          cacheMock.expects('getEventPackFor')
            .withArgs(10, 'a:1;b:2')
            .resolves(undefined)
        })

        it('should return events', () =>
          eventAdapter.fetchPack('account', 10, 'a:1;b:2')
            .should.eventually.eql([])
        )

        it('should call getEventsFor on cache', () => {
          cacheMock.verify()
        })

        it('should call getEventsFor on store', () => {
          storeMock.verify()
        })
      })
    })
  })

  describe('when storing events', () => {
    describe('when cache and store succeed', () => {
      var storeMock
      var cacheMock
      var events
      before(() => {
        events = []
        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('storeEvents')
          .withArgs(50, events)
          .resolves({})
        cacheMock.expects('storeEvents')
          .withArgs(50, events)
          .resolves({})
        return eventAdapter.store('account', 50, events)
      })

      it('should call storeEvents on cache', () => {
        cacheMock.verify()
      })

      it('should call storeEvents on store', () => {
        storeMock.verify()
      })
    })

    describe('when cache fails', () => {
      var storeMock
      var cacheMock
      var events
      before(() => {
        events = []
        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('storeEvents')
          .withArgs(50, events)
          .resolves({})
        cacheMock.expects('storeEvents')
          .withArgs(50, events)
          .rejects(new Error('no can do'))
      })

      it('should reject store with an error', () =>
        eventAdapter.store('account', 50, events)
          .should.be.rejectedWith("Failed to cache events for 'account' of '50' with Error: no can do")
      )

      it('should call storeEvents on cache', () => {
        cacheMock.verify()
      })

      it('should call storeEvents on store', () => {
        storeMock.verify()
      })
    })

    describe('when store fails', () => {
      var storeMock
      var cacheMock
      var events
      before(() => {
        events = []
        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('storeEvents')
          .withArgs(50, events)
          .rejects(new Error('no can do'))
        cacheMock.expects('storeEvents').never()
      })

      it('should reject store with an error', () =>
        eventAdapter.store('account', 50, events)
          .should.be.rejectedWith("Failed to store events for 'account' of '50' with Error: no can do")
      )

      it('should not call storeEvents on cache', () => {
        cacheMock.verify()
      })

      it('should call storeEvents on store', () => {
        storeMock.verify()
      })
    })
  })

  describe('when storing eventpack', () => {
    describe('when cache and store succeed', () => {
      var storeMock
      var cacheMock
      var events
      var loadedEvents
      before(() => {
        events = [ { id: 2 }, { id: 3 } ]
        loadedEvents = [ { id: 1 }, { id: 2 } ]
        const total = [ { id: 1 }, { id: 2 }, { id: 3 } ]
        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('getEventsFor')
          .withArgs(50, 1)
          .resolves(loadedEvents)
        storeMock.expects('storeEventPack')
          .withArgs(50, 'a:1', total)
          .resolves({})
        cacheMock.expects('getEventsFor')
          .withArgs(50, 1)
          .resolves(undefined)
        cacheMock.expects('storeEventPack')
          .withArgs(50, 'a:1', total)
          .resolves({})
        return eventAdapter.storePack('account', 50, 'a:1', 1, events)
      })

      it('should call storeEventPack on cache', () => {
        cacheMock.verify()
      })

      it('should call storeEventPack on store', () => {
        storeMock.verify()
      })
    })

    describe('when cache store fails', () => {
      var storeMock
      var cacheMock
      var events
      var loadedEvents
      before(() => {
        events = [ { id: 2 }, { id: 3 } ]
        loadedEvents = [ { id: 1 }, { id: 2 } ]
        var total = [ { id: 1 }, { id: 2 }, { id: 3 } ]
        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('getEventsFor').never()
        storeMock.expects('storeEventPack')
          .withArgs(50, 'a:1', total)
          .resolves({})
        cacheMock.expects('getEventsFor')
          .withArgs(50, 1)
          .resolves(loadedEvents)
        cacheMock.expects('storeEventPack')
          .withArgs(50, 'a:1', total)
          .rejects(new Error('cache is dead'))
      })

      it('should reject storePack with cache error', () =>
        eventAdapter.storePack('account', 50, 'a:1', 1, events)
          .should.be.rejectedWith("Failed to cache eventpack for 'account' of '50' with Error: cache is dead")
      )

      it('should call storeEventPack on cache', () => {
        cacheMock.verify()
      })

      it('should call storeEventPack on store', () => {
        storeMock.verify()
      })
    })

    describe('when storing eventpack fails', () => {
      var storeMock
      var cacheMock
      var events
      var loadedEvents
      before(() => {
        events = [ { id: 2 }, { id: 3 } ]
        loadedEvents = [ { id: 1 }, { id: 2 } ]
        var total = [ { id: 1 }, { id: 2 }, { id: 3 } ]
        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('getEventsFor')
          .withArgs(50, 1)
          .resolves(loadedEvents)
        storeMock.expects('storeEventPack')
          .withArgs(50, 'a:1', total)
          .rejects(new Error('store is busted'))
        cacheMock.expects('getEventsFor')
          .withArgs(50, 1)
          .resolves(undefined)
        cacheMock.expects('storeEventPack').never()
      })

      it('should reject storePack with cache error', () =>
        eventAdapter.storePack('account', 50, 'a:1', 1, events)
          .should.be.rejectedWith("Failed to store eventpack for 'account' of '50' with Error: store is busted")
      )

      it('should not call storeEventPack on cache', () => {
        cacheMock.verify()
      })

      it('should call storeEventPack on store', () => {
        storeMock.verify()
      })
    })

    describe('when fetching events fails', () => {
      var storeMock
      var cacheMock
      var events
      before(() => {
        events = [ { id: 2 }, { id: 3 } ]
        storeMock = sinon.mock(store)
        cacheMock = sinon.mock(cache)
        storeMock.expects('getEventsFor')
          .withArgs(50, 1)
          .rejects(new Error('read failed'))
        storeMock.expects('storeEventPack').never()
        cacheMock.expects('getEventsFor')
          .withArgs(50, 1)
          .resolves(undefined)
        cacheMock.expects('storeEventPack').never()
      })

      it('should reject storePack with cache error', () =>
        eventAdapter.storePack('account', 50, 'a:1', 1, events)
          .should.be.rejectedWith("Failed to get events for 'account' of '50' from store with Error: read failed")
      )

      it('should not call storeEventPack on cache', () => {
        cacheMock.verify()
      })

      it('should not call storeEventPack on store', () => {
        storeMock.verify()
      })
    })
  })
})
