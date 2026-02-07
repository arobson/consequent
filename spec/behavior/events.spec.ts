import { describe, it, expect, beforeAll } from 'vitest'
import eventAdapterFn from '../../src/events.js'

const store = {
  getEventsFor: () => {},
  getEventPackFor: () => {},
  storeEvents: () => {},
  storeEventPack: () => {}
} as any

const cache = {
  getEventsFor: () => {},
  getEventPackFor: () => {},
  storeEvents: () => {},
  storeEventPack: () => {}
} as any

describe('Events', () => {
  let eventAdapter: any
  beforeAll(() => {
    eventAdapter = eventAdapterFn({} as any, {} as any)
    eventAdapter.adapters.cache.account = Promise.resolve(cache)
    eventAdapter.adapters.store.account = Promise.resolve(store)
  })

  describe('when fetching events', () => {
    describe('and events are returned from cache', () => {
      let events: any[]
      beforeAll(() => {
        events = [{ id: 3 }, { id: 1 }, { id: 2 }]
        store.getEventsFor = () => { throw new Error('should not be called') }
        cache.getEventsFor = (id: any, lastId: any) => Promise.resolve(events)
      })

      it('should return events', async () => {
        const result = await eventAdapter.fetch('account', 10, 100)
        expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
      })
    })

    describe('and cache returns an error', () => {
      let events: any[]
      beforeAll(() => {
        events = [{ id: 3 }, { id: 1 }, { id: 2 }]
        store.getEventsFor = () => Promise.resolve(events)
        cache.getEventsFor = () => Promise.reject(new Error('bad cache'))
      })

      it('should return events', async () => {
        const result = await eventAdapter.fetch('account', 10, 100, true)
        expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
      })
    })

    describe('and no events are in cache', () => {
      describe('and events are returned from store', () => {
        let events: any[]
        beforeAll(() => {
          events = [{ id: 3 }, { id: 1 }, { id: 2 }]
          store.getEventsFor = () => Promise.resolve(events)
          cache.getEventsFor = () => Promise.resolve(undefined)
        })

        it('should return events', async () => {
          const result = await eventAdapter.fetch('account', 10, 100)
          expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
        })
      })

      describe('and store returns an error', () => {
        beforeAll(() => {
          store.getEventsFor = () => Promise.reject(new Error('store done blew up'))
          cache.getEventsFor = () => Promise.resolve(undefined)
        })

        it('should return events', async () => {
          const result = await eventAdapter.fetch('account', 10, 100, true)
          expect(result).toEqual([])
        })
      })

      describe('and no events are in store', () => {
        beforeAll(() => {
          store.getEventsFor = () => Promise.resolve(undefined)
          cache.getEventsFor = () => Promise.resolve(undefined)
        })

        it('should return events', async () => {
          const result = await eventAdapter.fetch('account', 10, 100)
          expect(result).toEqual([])
        })
      })
    })
  })

  describe('when fetching eventpack', () => {
    describe('and eventpack is returned from cache', () => {
      let events: any[]
      beforeAll(() => {
        events = [{ id: 3 }, { id: 1 }, { id: 2 }]
        store.getEventPackFor = () => { throw new Error('should not be called') }
        cache.getEventPackFor = () => Promise.resolve(events)
      })

      it('should return events', async () => {
        const result = await eventAdapter.fetchPack('account', 10, 'a:1;b:2')
        expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
      })
    })

    describe('and cache returns an error', () => {
      let events: any[]
      beforeAll(() => {
        events = [{ id: 3 }, { id: 1 }, { id: 2 }]
        store.getEventPackFor = () => Promise.resolve(events)
        cache.getEventPackFor = () => Promise.reject(new Error('I barfed'))
      })

      it('should return events', async () => {
        const result = await eventAdapter.fetchPack('account', 10, 'a:1;b:2')
        expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
      })
    })

    describe('and no eventpack is in cache', () => {
      describe('and eventpack is returned from store', () => {
        let events: any[]
        beforeAll(() => {
          events = [{ id: 3 }, { id: 1 }, { id: 2 }]
          store.getEventPackFor = () => Promise.resolve(events)
          cache.getEventPackFor = () => Promise.resolve(undefined)
        })

        it('should return events', async () => {
          const result = await eventAdapter.fetchPack('account', 10, 'a:1;b:2')
          expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
        })
      })

      describe('and no pack was in the store', () => {
        beforeAll(() => {
          store.getEventPackFor = () => Promise.resolve(undefined)
          cache.getEventPackFor = () => Promise.resolve(undefined)
        })

        it('should return events', async () => {
          const result = await eventAdapter.fetchPack('account', 10, 'a:1;b:2')
          expect(result).toEqual([])
        })
      })

      describe('and store returns an error', () => {
        beforeAll(() => {
          store.getEventPackFor = () => Promise.reject(new Error('oops'))
          cache.getEventPackFor = () => Promise.resolve(undefined)
        })

        it('should return events', async () => {
          const result = await eventAdapter.fetchPack('account', 10, 'a:1;b:2')
          expect(result).toEqual([])
        })
      })
    })
  })

  describe('when storing events', () => {
    describe('when cache and store succeed', () => {
      let events: any[]
      beforeAll(() => {
        events = []
        store.storeEvents = () => Promise.resolve({})
        cache.storeEvents = () => Promise.resolve({})
        return eventAdapter.store('account', 50, events)
      })

      it('should succeed without error', () => {
        // if we got here, both store and cache succeeded
      })
    })

    describe('when cache fails', () => {
      let events: any[]
      beforeAll(() => {
        events = []
        store.storeEvents = () => Promise.resolve({})
        cache.storeEvents = () => Promise.reject(new Error('no can do'))
      })

      it('should reject store with an error', async () => {
        await expect(eventAdapter.store('account', 50, events))
          .rejects.toThrow("Failed to cache events for 'account' of '50' with Error: no can do")
      })
    })

    describe('when store fails', () => {
      let events: any[]
      beforeAll(() => {
        events = []
        store.storeEvents = () => Promise.reject(new Error('no can do'))
        cache.storeEvents = () => { throw new Error('should not be called') }
      })

      it('should reject store with an error', async () => {
        await expect(eventAdapter.store('account', 50, events))
          .rejects.toThrow("Failed to store events for 'account' of '50' with Error: no can do")
      })
    })
  })

  describe('when storing eventpack', () => {
    describe('when cache and store succeed', () => {
      beforeAll(() => {
        const loadedEvents = [{ id: 1 }, { id: 2 }]
        const total = [{ id: 1 }, { id: 2 }, { id: 3 }]
        store.getEventsFor = (id: any, lastId: any) => Promise.resolve(loadedEvents)
        store.storeEventPack = () => Promise.resolve({})
        cache.getEventsFor = () => Promise.resolve(undefined)
        cache.storeEventPack = () => Promise.resolve({})
        return eventAdapter.storePack('account', 50, 'a:1', 1, [{ id: 2 }, { id: 3 }])
      })

      it('should succeed', () => {
        // success
      })
    })

    describe('when cache store fails', () => {
      beforeAll(() => {
        const loadedEvents = [{ id: 1 }, { id: 2 }]
        store.getEventsFor = () => { throw new Error('should not be called') }
        store.storeEventPack = () => Promise.resolve({})
        cache.getEventsFor = () => Promise.resolve(loadedEvents)
        cache.storeEventPack = () => Promise.reject(new Error('cache is dead'))
      })

      it('should reject storePack with cache error', async () => {
        await expect(eventAdapter.storePack('account', 50, 'a:1', 1, [{ id: 2 }, { id: 3 }]))
          .rejects.toThrow("Failed to cache eventpack for 'account' of '50' with Error: cache is dead")
      })
    })

    describe('when storing eventpack fails', () => {
      beforeAll(() => {
        const loadedEvents = [{ id: 1 }, { id: 2 }]
        store.getEventsFor = () => Promise.resolve(loadedEvents)
        store.storeEventPack = () => Promise.reject(new Error('store is busted'))
        cache.getEventsFor = () => Promise.resolve(undefined)
        cache.storeEventPack = () => { throw new Error('should not be called') }
      })

      it('should reject storePack with cache error', async () => {
        await expect(eventAdapter.storePack('account', 50, 'a:1', 1, [{ id: 2 }, { id: 3 }]))
          .rejects.toThrow("Failed to store eventpack for 'account' of '50' with Error: store is busted")
      })
    })

    describe('when fetching events fails', () => {
      beforeAll(() => {
        store.getEventsFor = () => Promise.reject(new Error('read failed'))
        store.storeEventPack = () => { throw new Error('should not be called') }
        cache.getEventsFor = () => Promise.resolve(undefined)
        cache.storeEventPack = () => { throw new Error('should not be called') }
      })

      it('should reject storePack with cache error', async () => {
        await expect(eventAdapter.storePack('account', 50, 'a:1', 1, [{ id: 2 }, { id: 3 }]))
          .rejects.toThrow("Failed to get events for 'account' of '50' from store with Error: read failed")
      })
    })
  })

  describe('when fetching events by index', () => {
    describe('and store succeeds', () => {
      beforeAll(() => {
        store.getEventsByIndex = (_indexName: any, _indexValue: any, _lastEventId: any) =>
          Promise.resolve([{ id: 3 }, { id: 1 }, { id: 2 }])
      })

      it('should return sorted events', async () => {
        const result = await eventAdapter.fetchByIndex('account', 'field', 'value', undefined)
        expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
      })
    })

    describe('and store fails with noError', () => {
      beforeAll(() => {
        store.getEventsByIndex = () => Promise.reject(new Error('index fail'))
      })

      it('should return empty array', async () => {
        const result = await eventAdapter.fetchByIndex('account', 'field', 'value', undefined, true)
        expect(result).toEqual([])
      })
    })

    describe('and store fails without noError', () => {
      beforeAll(() => {
        store.getEventsByIndex = () => Promise.reject(new Error('index fail'))
      })

      it('should throw', async () => {
        await expect(eventAdapter.fetchByIndex('account', 'field', 'value', undefined))
          .rejects.toThrow('Failed to get account events by index field of value')
      })
    })
  })

  describe('when getting event stream', () => {
    describe('and store succeeds', () => {
      let streamResult: any
      beforeAll(() => {
        store.getEventStreamFor = (_id: any, _options: any) => [{ id: 1 }, { id: 2 }]
      })

      it('should delegate to store.getEventStreamFor', async () => {
        const result = await eventAdapter.fetchStream('account', 'actor-1', {})
        expect(result).toEqual([{ id: 1 }, { id: 2 }])
      })
    })
  })

  describe('when cache lacks getEventPackFor', () => {
    beforeAll(() => {
      const originalGetEventPackFor = cache.getEventPackFor
      delete cache.getEventPackFor
      store.getEventPackFor = () => Promise.resolve([{ id: 1 }])
      // Restore after this suite sets up
      afterAll(() => {
        cache.getEventPackFor = originalGetEventPackFor
      })
    })

    it('should fall through to store', async () => {
      const result = await eventAdapter.fetchPack('account', 10, 'a:1')
      expect(result).toEqual([{ id: 1 }])
    })
  })

  describe('when store lacks getEventPackFor', () => {
    beforeAll(() => {
      cache.getEventPackFor = () => Promise.resolve(undefined)
      const originalStoreGetEventPackFor = store.getEventPackFor
      delete store.getEventPackFor
      afterAll(() => {
        store.getEventPackFor = originalStoreGetEventPackFor
      })
    })

    it('should return empty array', async () => {
      const result = await eventAdapter.fetchPack('account', 10, 'a:1')
      expect(result).toEqual([])
    })
  })

  describe('when store lacks storeEventPack in storePack', () => {
    beforeAll(() => {
      const originalStoreEventPack = store.storeEventPack
      delete store.storeEventPack
      cache.getEventsFor = () => Promise.resolve([])
      store.getEventsFor = () => Promise.resolve([])
      afterAll(() => {
        store.storeEventPack = originalStoreEventPack
      })
    })

    it('should resolve without error', async () => {
      await expect(eventAdapter.storePack('account', 50, 'a:1', 1, [{ id: 1 }]))
        .resolves.toBeUndefined()
    })
  })

  describe('adapter initialization errors', () => {
    describe('when cache adapter fails without noError', () => {
      let failAdapter: any
      beforeAll(() => {
        const failCacheLib = {
          create: () => Promise.reject(new Error('cache init fail'))
        }
        const storeLib = {
          create: () => Promise.resolve(store)
        }
        failAdapter = eventAdapterFn(storeLib as any, failCacheLib as any)
      })

      it('should throw for fetch without noError', async () => {
        await expect(failAdapter.fetch('account', 10, undefined))
          .rejects.toThrow("Failed to initialize event cache adapter for type 'account'")
      })
    })

    describe('when store adapter fails', () => {
      let failAdapter: any
      beforeAll(() => {
        const cacheLib = {
          create: () => Promise.resolve(cache)
        }
        const failStoreLib = {
          create: () => Promise.reject(new Error('store init fail'))
        }
        failAdapter = eventAdapterFn(failStoreLib as any, cacheLib as any)
        cache.getEventsFor = () => Promise.resolve(undefined)
      })

      it('should throw for fetch', async () => {
        await expect(failAdapter.fetch('account', 10, undefined))
          .rejects.toThrow("Failed to initialize event cache adapter for type 'account'")
      })
    })

    describe('when both adapters fail for store operation', () => {
      let failAdapter: any
      beforeAll(() => {
        const failCacheLib = {
          create: () => Promise.reject(new Error('cache init fail'))
        }
        const failStoreLib = {
          create: () => Promise.reject(new Error('store init fail'))
        }
        failAdapter = eventAdapterFn(failStoreLib as any, failCacheLib as any)
      })

      it('should throw for store', async () => {
        await expect(failAdapter.store('account', 50, []))
          .rejects.toThrow("Failed to initialize event cache or event store adapter for type 'account'")
      })
    })
  })
})
