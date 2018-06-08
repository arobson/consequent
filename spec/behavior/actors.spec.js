require('../setup')
const loader = require('../../src/loader')
const fount = require('fount')
const actorFn = require('../../src/actors')
const flakes = require('node-flakes')()

const store = {
  fetch: _.noop,
  store: _.noop
}

const cache = {
  fetch: _.noop,
  store: _.noop
}

describe('Actors', () => {
  var actors
  before(function () {
    return Promise.all([
      loader(fount, './spec/actors')
        .then((list) => {
          actors = list
        }),
      flakes.seedFromEnvironment()
    ])
  })

  describe('when fetching an actor', () => {
    var actor
    before(() => {
      actor = actorFn(flakes, actors, {}, {})
      actor.adapters.store.account = Promise.resolve(store)
      actor.adapters.cache.account = Promise.resolve(cache)
    })

    describe('and cached snapshot exists', () => {
      var cacheMock
      var storeMock
      var account

      before(() => {
        account = {
          number: 1010
        }

        cacheMock = sinon.mock(cache)
        cacheMock.expects('fetch')
          .withArgs(1010)
          .resolves(account)
        storeMock = sinon.mock(store)
        storeMock.expects('fetch').never()
      })

      it('should resolve fetch with instance', () => {
        return actor.fetch('account', 1010)
          .should.eventually.partiallyEql({ state: account })
      })

      it('should call cache fetch', () => {
        cacheMock.verify()
      })

      it('should not call store fetch', () => {
        storeMock.verify()
      })
    })

    describe('and cache read throws an error', () => {
      var cacheMock
      var storeMock
      var account

      before(() => {
        account = {
          number: 1010
        }

        cacheMock = sinon.mock(cache)
        cacheMock.expects('fetch')
          .withArgs(1010)
          .rejects(new Error('bad juju'))
        storeMock = sinon.mock(store)
        storeMock.expects('fetch')
          .withArgs(1010)
          .resolves(account)
      })

      it('should resolve fetch with instance', () => {
        return actor.fetch('account', 1010)
          .should.eventually.partiallyEql({ state: account })
      })

      it('should call cache fetch', () => {
        cacheMock.verify()
      })

      it('should call store fetch', () => {
        storeMock.verify()
      })
    })

    describe('and cache misses', () => {
      describe('and no snapshot exists', () => {
        var cacheMock, storeMock, account

        before(() => {
          account = {
            number: 1010
          }

          cacheMock = sinon.mock(cache)
          cacheMock.expects('fetch')
            .withArgs(1010)
            .resolves(undefined)
          storeMock = sinon.mock(store)
          storeMock.expects('fetch')
            .withArgs(1010)
            .resolves(undefined)
        })

        it('should resolve fetch with instance', () => {
          return actor.fetch('account', 1010)
            .should.eventually.partiallyEql({ state: account })
        })

        it('should call cache fetch', () => {
          cacheMock.verify()
        })

        it('should call store fetch', () => {
          storeMock.verify()
        })
      })

      describe('and store read throws an error', () => {
        var cacheMock
        var storeMock

        before(() => {
          cacheMock = sinon.mock(cache)
          cacheMock.expects('fetch')
            .withArgs(1010)
            .resolves(undefined)
          storeMock = sinon.mock(store)
          storeMock.expects('fetch')
            .withArgs(1010)
            .rejects(new Error('This is bad'))
        })

        it('should resolve fetch with instance', () => {
          return actor.fetch('account', 1010)
            .should.be.rejectedWith("Failed to get instance '1010' of 'account' from store with Error: This is bad")
        })

        it('should call cache fetch', () => {
          cacheMock.verify()
        })

        it('should call store fetch', () => {
          storeMock.verify()
        })
      })

      describe('and store has the snapshot', () => {
        var cacheMock
        var storeMock
        var account

        before(() => {
          account = {
            number: 1010
          }

          cacheMock = sinon.mock(cache)
          cacheMock.expects('fetch')
            .withArgs(1010)
            .resolves(undefined)
          storeMock = sinon.mock(store)
          storeMock.expects('fetch')
            .withArgs(1010)
            .resolves(account)
        })

        it('should resolve fetch with instance', () => {
          return actor.fetch('account', 1010)
            .should.eventually.partiallyEql({ state: account })
        })

        it('should call cache fetch', () => {
          cacheMock.verify()
        })

        it('should call store fetch', () => {
          storeMock.verify()
        })
      })
    })
  })

  describe('when storing snapshot', () => {
    var actor
    before(() => {
      actor = actorFn(flakes, actors, {}, {}, 'a')
      actor.adapters.store.account = store
      actor.adapters.cache.account = cache
    })

    describe('when store and cache are successful', () => {
      var cacheMock
      var storeMock
      var account

      before(() => {
        account = {
          number: 1001,
          _vector: 'a:1'
        }
        cacheMock = sinon.mock(cache)
        cacheMock.expects('store')
          .withArgs(1001, 'a:2', account)
          .resolves(account)
        storeMock = sinon.mock(store)
        storeMock.expects('store')
          .withArgs(1001, 'a:2', account)
          .resolves(account)
      })

      it('should resolve store call', () => {
        return actor.store({ actor: { type: 'account' }, state: account })
          .should.eventually.eql(account)
      })

      it('should store snapshot', () => {
        storeMock.verify()
      })

      it('should cache snapshot', () => {
        cacheMock.verify()
      })
    })

    describe('when store fails', () => {
      var cacheMock
      var storeMock
      var account

      before(() => {
        account = {
          number: 1001,
          _vector: 'a:1'
        }
        cacheMock = sinon.mock(cache)
        cacheMock.expects('store').never()
        storeMock = sinon.mock(store)
        storeMock.expects('store')
          .withArgs(1001, 'a:2', account)
          .rejects(new Error('fail whale'))
      })

      it('should resolve store call', () => {
        return actor.store({ actor: { type: 'account' }, state: account })
          .should.be.rejectedWith("Failed to store actor '1001' of 'account' with Error: fail whale")
      })

      it('should store snapshot', () => {
        storeMock.verify()
      })

      it('should not cache snapshot', () => {
        cacheMock.verify()
      })
    })

    describe('when cache fails', () => {
      var cacheMock
      var storeMock
      var account

      before(() => {
        account = {
          number: 1001,
          _vector: 'a:1'
        }
        cacheMock = sinon.mock(cache)
        cacheMock.expects('store')
          .withArgs(1001, 'a:2', account)
          .rejects(new Error('No cache for you'))
        storeMock = sinon.mock(store)
        storeMock.expects('store')
          .withArgs(1001, 'a:2', account)
          .resolves(account)
      })

      it('should resolve store call', () => {
        return actor.store({ actor: { type: 'account' }, state: account })
          .should.be.rejectedWith("Failed to cache actor '1001' of 'account' with Error: No cache for you")
      })

      it('should store snapshot', () => {
        storeMock.verify()
      })

      it('should not cache snapshot', () => {
        cacheMock.verify()
      })
    })
  })
})
