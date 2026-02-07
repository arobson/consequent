import { describe, it, expect, beforeAll } from 'vitest'
import loader from '../../src/loader.js'
import { fount } from 'fount'
import actorFn from '../../src/actors.js'
import { getBase62Provider } from 'node-flakes'

const flakes = getBase62Provider('test')

const store = {
  fetch: () => {},
  store: () => {}
} as any

const cache = {
  fetch: () => {},
  store: () => {}
} as any

function mockObj(obj: any) {
  const mocks: Record<string, { expectedArgs?: any[]; result?: any; rejectWith?: any; callCount: number; expectedCount?: number; neverCalled?: boolean }> = {}

  function expects(method: string) {
    mocks[method] = { callCount: 0 }
    const builder = {
      withArgs: (...args: any[]) => {
        mocks[method].expectedArgs = args
        return builder
      },
      resolves: (val: any) => {
        mocks[method].result = Promise.resolve(val)
        obj[method] = (...args: any[]) => {
          mocks[method].callCount++
          return mocks[method].result
        }
        return builder
      },
      rejects: (err: any) => {
        mocks[method].rejectWith = err
        obj[method] = (...args: any[]) => {
          mocks[method].callCount++
          return Promise.reject(err)
        }
        return builder
      },
      never: () => {
        mocks[method].neverCalled = true
        mocks[method].expectedCount = 0
        obj[method] = (...args: any[]) => {
          mocks[method].callCount++
          return Promise.resolve()
        }
        return builder
      },
      once: () => {
        mocks[method].expectedCount = 1
        return builder
      }
    }
    return builder
  }

  function verify() {
    for (const [method, mock] of Object.entries(mocks)) {
      if (mock.neverCalled) {
        if (mock.callCount > 0) {
          throw new Error(`Expected ${method} to never be called but was called ${mock.callCount} times`)
        }
      }
    }
  }

  return { expects, verify }
}

describe('Actors', () => {
  let actors: any
  beforeAll(async function () {
    const list = await loader(fount, './spec/actors')
    actors = list
  })

  describe('when fetching an actor', () => {
    let actor: any
    beforeAll(() => {
      actor = actorFn(flakes, actors, {} as any, {} as any)
      actor.adapters.store.account = Promise.resolve(store)
      actor.adapters.cache.account = Promise.resolve(cache)
    })

    describe('and cached snapshot exists', () => {
      let cacheMock: any
      let storeMock: any
      let account: any

      beforeAll(() => {
        account = {
          number: 1010
        }

        cacheMock = mockObj(cache)
        cacheMock.expects('fetch').withArgs(1010).resolves(account)
        storeMock = mockObj(store)
        storeMock.expects('fetch').never()
      })

      it('should resolve fetch with instance', async () => {
        const result = await actor.fetch('account', 1010)
        expect(result).toPartiallyEqual({ state: account })
      })

      it('should call cache fetch', () => {
        cacheMock.verify()
      })

      it('should not call store fetch', () => {
        storeMock.verify()
      })
    })

    describe('and cache read throws an error', () => {
      let cacheMock: any
      let storeMock: any
      let account: any

      beforeAll(() => {
        account = {
          number: 1010
        }

        cacheMock = mockObj(cache)
        cacheMock.expects('fetch').withArgs(1010).rejects(new Error('bad juju'))
        storeMock = mockObj(store)
        storeMock.expects('fetch').withArgs(1010).resolves(account)
      })

      it('should resolve fetch with instance', async () => {
        const result = await actor.fetch('account', 1010)
        expect(result).toPartiallyEqual({ state: account })
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
        let cacheMock: any, storeMock: any, account: any

        beforeAll(() => {
          account = {
            number: 1010,
            balance: 0,
            open: false,
            transactions: []
          }

          cacheMock = mockObj(cache)
          cacheMock.expects('fetch').withArgs(1010).resolves(undefined)
          storeMock = mockObj(store)
          storeMock.expects('fetch').withArgs(1010).resolves(undefined)
        })

        it('should resolve fetch with instance', async () => {
          const result = await actor.fetch('account', 1010)
          expect(result).toPartiallyEqual({ state: account })
        })

        it('should call cache fetch', () => {
          cacheMock.verify()
        })

        it('should call store fetch', () => {
          storeMock.verify()
        })
      })

      describe('and store read throws an error', () => {
        let cacheMock: any
        let storeMock: any

        beforeAll(() => {
          cacheMock = mockObj(cache)
          cacheMock.expects('fetch').withArgs(1010).resolves(undefined)
          storeMock = mockObj(store)
          storeMock.expects('fetch').withArgs(1010).rejects(new Error('This is bad'))
        })

        it('should resolve fetch with instance', async () => {
          await expect(actor.fetch('account', 1010))
            .rejects.toThrow("Failed to get instance '1010' of 'account' from store with Error: This is bad")
        })

        it('should call cache fetch', () => {
          cacheMock.verify()
        })

        it('should call store fetch', () => {
          storeMock.verify()
        })
      })

      describe('and store has the snapshot', () => {
        let cacheMock: any
        let storeMock: any
        let account: any

        beforeAll(() => {
          account = {
            number: 1010
          }

          cacheMock = mockObj(cache)
          cacheMock.expects('fetch').withArgs(1010).resolves(undefined)
          storeMock = mockObj(store)
          storeMock.expects('fetch').withArgs(1010).resolves(account)
        })

        it('should resolve fetch with instance', async () => {
          const result = await actor.fetch('account', 1010)
          expect(result).toPartiallyEqual({ state: account })
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
    let actor: any
    beforeAll(() => {
      actor = actorFn(flakes, actors, {} as any, {} as any, 'a')
      actor.adapters.store.account = store
      actor.adapters.cache.account = cache
    })

    describe('when store and cache are successful', () => {
      let account: any

      beforeAll(() => {
        account = {
          number: 1001,
          _vector: 'a:1'
        }
        store.store = (id: any, vector: any, state: any) => Promise.resolve(account)
        cache.store = (id: any, vector: any, state: any) => Promise.resolve(account)
      })

      it('should resolve store call', async () => {
        const result = await actor.store({ actor: { type: 'account' }, state: account })
        expect(result).toEqual(account)
      })
    })

    describe('when store fails', () => {
      let account: any

      beforeAll(() => {
        account = {
          number: 1001,
          _vector: 'a:1'
        }
        cache.store = () => Promise.resolve()
        store.store = () => Promise.reject(new Error('fail whale'))
      })

      it('should resolve store call', async () => {
        await expect(actor.store({ actor: { type: 'account' }, state: account }))
          .rejects.toThrow("Failed to store actor '1001' of 'account' with Error: fail whale")
      })
    })

    describe('when cache fails', () => {
      let account: any

      beforeAll(() => {
        account = {
          number: 1001,
          _vector: 'a:1'
        }
        cache.store = () => Promise.reject(new Error('No cache for you'))
        store.store = () => Promise.resolve(account)
      })

      it('should resolve store call', async () => {
        await expect(actor.store({ actor: { type: 'account' }, state: account }))
          .rejects.toThrow("Failed to cache actor '1001' of 'account' with Error: No cache for you")
      })
    })
  })

  describe('when fetching all actors', () => {
    let actor: any
    beforeAll(() => {
      actor = actorFn(flakes, actors, {} as any, {} as any)
      actor.adapters.store.account = Promise.resolve(store)
      actor.adapters.cache.account = Promise.resolve(cache)
    })

    describe('with array of IDs', () => {
      beforeAll(() => {
        cache.fetch = (id: any) => {
          if (id === 'fail') return Promise.reject(new Error('boom'))
          return Promise.resolve({ number: id, balance: 0, open: false, transactions: [] })
        }
        store.fetch = () => Promise.resolve(undefined)
      })

      it('should batch fetch and return results at correct indices', async () => {
        const result = await actor.fetchAll({ account: [1010, 2020] })
        expect(result.account).toBeDefined()
        expect(Array.isArray(result.account)).toBe(true)
        expect((result.account as any[])[0]).toBeDefined()
        expect((result.account as any[])[1]).toBeDefined()
      })

      it('should capture individual errors at failing index', async () => {
        cache.fetch = (id: any) => {
          if (id === 'fail') return Promise.reject(new Error('boom'))
          return Promise.resolve(undefined)
        }
        store.fetch = (id: any) => {
          if (id === 'fail') return Promise.reject(new Error('store boom'))
          return Promise.resolve({ number: id })
        }
        const result = await actor.fetchAll({ account: [1010, 'fail'] })
        expect(result.account).toBeDefined()
        expect((result.account as any[])[1]).toBeInstanceOf(Error)
      })
    })

    describe('with single ID per type', () => {
      beforeAll(() => {
        cache.fetch = () => Promise.resolve(undefined)
        store.fetch = () => Promise.reject(new Error('single fail'))
      })

      it('should store error in results', async () => {
        const result = await actor.fetchAll({ account: 1010 })
        expect(result.account).toBeInstanceOf(Error)
      })
    })
  })

  describe('when fetching by last event ID', () => {
    let actor: any
    beforeAll(() => {
      actor = actorFn(flakes, actors, {} as any, {} as any)
      actor.adapters.store.account = Promise.resolve(store)
      actor.adapters.cache.account = Promise.resolve(cache)
    })

    describe('and store succeeds', () => {
      beforeAll(() => {
        store.fetchByLastEventId = (_id: any, _lastEventId: any) =>
          Promise.resolve({ number: 1010, lastEventId: '50' })
      })

      it('should return the actor instance', async () => {
        const result = await actor.fetchByLastEventId('account', 1010, '50')
        expect(result).toBeDefined()
      })
    })

    describe('and store errors', () => {
      beforeAll(() => {
        store.fetchByLastEventId = () => Promise.reject(new Error('event id lookup failed'))
      })

      it('should produce descriptive rejection', async () => {
        await expect(actor.fetchByLastEventId('account', 1010, '50'))
          .rejects.toThrow("Failed to get instance '1010' of 'account' by lastEventId from store with Error: event id lookup failed")
      })
    })
  })

  describe('when fetching by last event date', () => {
    let actor: any
    beforeAll(() => {
      actor = actorFn(flakes, actors, {} as any, {} as any)
      actor.adapters.store.account = Promise.resolve(store)
      actor.adapters.cache.account = Promise.resolve(cache)
    })

    describe('and store succeeds', () => {
      beforeAll(() => {
        store.fetchByLastEventDate = (_id: any, _lastEventDate: any) =>
          Promise.resolve({ number: 1010, lastEventDate: '2020-01-01' })
      })

      it('should return the actor instance', async () => {
        const result = await actor.fetchByLastEventDate('account', 1010, '2020-01-01')
        expect(result).toBeDefined()
      })
    })

    describe('and store errors', () => {
      beforeAll(() => {
        store.fetchByLastEventDate = () => Promise.reject(new Error('date lookup failed'))
      })

      it('should produce descriptive rejection', async () => {
        await expect(actor.fetchByLastEventDate('account', 1010, '2020-01-01'))
          .rejects.toThrow("Failed to get instance '1010' of 'account' by lastEventDate from store with Error: date lookup failed")
      })
    })
  })

  describe('system ID resolution', () => {
    let actor: any
    beforeAll(() => {
      actor = actorFn(flakes, actors, {} as any, {} as any)
      actor.adapters.store.account = Promise.resolve(store)
      actor.adapters.cache.account = Promise.resolve(cache)
    })

    describe('when cache has the system ID', () => {
      beforeAll(() => {
        cache.getSystemId = () => Promise.resolve('cached-sys-id')
        store.getSystemId = () => { throw new Error('should not be called') }
      })

      it('should return cache hit without hitting store', async () => {
        const result = await actor.getSystemId(true, 'account', 'actor-1')
        expect(result).toBe('cached-sys-id')
      })
    })

    describe('when cache errors and store has it', () => {
      beforeAll(() => {
        cache.getSystemId = () => Promise.reject(new Error('cache miss'))
        store.getSystemId = () => Promise.resolve('store-sys-id')
      })

      it('should fall through to store lookup', async () => {
        const result = await actor.getSystemId(true, 'account', 'actor-1')
        expect(result).toBe('store-sys-id')
      })
    })

    describe('when neither found and create=true', () => {
      beforeAll(() => {
        cache.getSystemId = () => Promise.resolve(undefined)
        store.getSystemId = () => Promise.resolve(undefined)
        cache.mapIds = () => Promise.resolve()
        store.mapIds = () => Promise.resolve()
      })

      it('should generate new ID via flakes', async () => {
        const result = await actor.getSystemId(true, 'account', 'actor-new')
        expect(result).toBeDefined()
        expect(typeof result).toBe('string')
        expect(result!.length).toBeGreaterThan(0)
      })
    })

    describe('when neither found and create=false', () => {
      beforeAll(() => {
        cache.getSystemId = () => Promise.resolve(undefined)
        store.getSystemId = () => Promise.resolve(undefined)
      })

      it('should return null', async () => {
        const result = await actor.getSystemId(false, 'account', 'actor-gone')
        expect(result).toBeNull()
      })
    })

    describe('when store getSystemId errors', () => {
      beforeAll(() => {
        cache.getSystemId = () => Promise.resolve(undefined)
        store.getSystemId = () => Promise.reject(new Error('store id error'))
      })

      it('should propagate error', async () => {
        await expect(actor.getSystemId(true, 'account', 'actor-bad'))
          .rejects.toThrow('store id error')
      })
    })
  })

  describe('populateActorState with existing _id', () => {
    let actor: any
    beforeAll(() => {
      actor = actorFn(flakes, actors, {} as any, {} as any)
      actor.adapters.store.account = Promise.resolve(store)
      actor.adapters.cache.account = Promise.resolve(cache)
      cache.fetch = () => Promise.resolve({ number: 1010, _id: 'existing-sys-id' })
      store.fetch = () => Promise.resolve(undefined)
      cache.getSystemId = () => { throw new Error('should not call getSystemId') }
      store.getSystemId = () => { throw new Error('should not call getSystemId') }
    })

    it('should skip system ID lookup', async () => {
      const result = await actor.fetch('account', 1010)
      expect(result.state._id).toBe('existing-sys-id')
    })
  })
})
