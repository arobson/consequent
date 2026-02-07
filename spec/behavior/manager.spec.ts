import { describe, it, expect, beforeAll, vi } from 'vitest'
import loader from '../../src/loader.js'
import { fount } from 'fount'
import { getBase62Provider } from 'node-flakes'

const flakes = getBase62Provider('test')

function mockQueue(id?: any, fn?: any) {
  const queue = {
    add: (...args: any[]) => Promise.resolve(fn ? fn() : undefined)
  }
  if (!id) {
    queue.add = () => { throw new Error('add should not be called') }
  }
  return queue
}

const actorAdapter = {
  fetch: () => {},
  findAncestor: () => {},
  store: () => {}
} as any

const eventAdapter = {
  fetch: () => {},
  storePack: () => {}
} as any

const applySpy = vi.fn(function (a: any, q: any, t: any, e: any, x: any) {
  x.applied = x.applied || []
  x.applied.push(e)
  return Promise.resolve()
})

// We use dynamic import + vi.mock for proxyquire replacement
vi.mock('../../src/apply.js', () => ({
  default: (...args: any[]) => applySpy(...args)
}))

const { default: managerFn } = await import('../../src/manager.js')

describe('Manager', () => {
  let actors: any
  beforeAll(async () => {
    const list = await loader(fount, './spec/actors')
    actors = list
  })

  describe('when actor fetch fails', () => {
    let manager: any
    beforeAll(() => {
      actorAdapter.fetch = () => Promise.reject(new Error('Nope sauce'))
      manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue() as any)
    })

    it('should reject with an error', async () => {
      await expect(manager.getOrCreate('account', 100))
        .rejects.toThrow('Nope sauce')
    })
  })

  describe('when no actor exists', () => {
    let manager: any
    let state: any
    let actor: any
    let events: any
    let eventMock: any
    const id111 = flakes()

    beforeAll(() => {
      state = {
        _lastEventId: 0,
        _id: id111,
        id: 111
      }
      actor = {
        type: 'account'
      }
      events = []
      const instance = {
        actor: actor,
        state: state,
        events: []
      }

      actorAdapter.fetch = () => Promise.resolve(instance)
      actorAdapter.store = () => { throw new Error('store should not be called') }
      eventAdapter.fetch = () => Promise.resolve(events)
      eventAdapter.storePack = () => { throw new Error('storePack should not be called') }
      manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue() as any)
    })

    it('should resolve to a default instance', async () => {
      const a = await manager.getOrCreate('account', 111)
      expect(a).toEqual({
        state: state,
        actor: actor,
        events: []
      })
    })
  })

  describe('when single actor instance exists', () => {
    let manager: any
    let actor: any
    let state: any
    let events: any
    const id100 = flakes()
    beforeAll(() => {
      state = {
        _lastEventId: 1,
        _id: id100,
        id: 100
      }
      actor = {
        type: 'account'
      }
      events = [{ id: 2 }, { id: 3 }]
      const instance = {
        actor: actor,
        state: state
      }
      actorAdapter.fetch = () => Promise.resolve(instance)
      actorAdapter.store = () => { throw new Error('store should not be called') }
      eventAdapter.fetch = () => Promise.resolve(events)
      eventAdapter.storePack = () => { throw new Error('storePack should not be called') }

      manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue() as any)
    })

    it('should result in updated actor', async () => {
      const result = await manager.getOrCreate('account', 100)
      expect(result).toEqual({
        state: state,
        actor: actor,
        applied: events
      })
    })
  })

  describe('when multiple actor instances exist', () => {
    let manager: any
    let actor: any
    let state: any
    let events: any
    const id100 = flakes()
    beforeAll(() => {
      actor = { type: 'account' }
      const instances = [
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
      events = [{ id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
      const instance = {
        actor: actor,
        state: state
      }
      actorAdapter.fetch = () => Promise.resolve(instances)
      actorAdapter.findAncestor = () => Promise.resolve(instance)
      actorAdapter.store = () => { throw new Error('store should not be called') }
      eventAdapter.fetch = () => Promise.resolve(events)
      eventAdapter.storePack = () => { throw new Error('storePack should not be called') }

      manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue() as any)
    })

    it('should result in updated actor', async () => {
      const result = await manager.getOrCreate('account', 100)
      expect(result).toEqual({
        actor: actor,
        state: state,
        applied: events
      })
    })
  })

  describe('when event threshold is exceeded', () => {
    describe('in normal mode', () => {
      let manager: any
      let actor: any
      let state: any
      let events: any
      const id100 = flakes()
      beforeAll(() => {
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
        events = [{ id: 2 }, { id: 3 }]
        const instance = {
          actor: actor,
          state: state
        }
        actorAdapter.fetch = () => Promise.resolve(instance)
        actorAdapter.store = () => Promise.resolve({})
        eventAdapter.fetch = () => Promise.resolve(events)
        eventAdapter.storePack = () => Promise.resolve()

        manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue() as any)
      })

      it('should result in updated actor', async () => {
        const result = await manager.getOrCreate('account', 100)
        expect(result).toEqual({
          actor: actor,
          state: state,
          applied: events
        })
      })
    })

    describe('in readOnly without snapshotOnRead', () => {
      let manager: any
      let actor: any
      let state: any
      let events: any
      const id100 = flakes()
      beforeAll(() => {
        actor = {
          type: 'account',
          eventThreshold: 2
        }
        state = {
          _lastEventId: 1,
          _id: id100,
          id: 100
        }
        events = [{ id: 2 }, { id: 3 }]
        const instance = {
          actor: actor,
          state: state
        }
        actorAdapter.fetch = () => Promise.resolve(instance)
        actorAdapter.store = () => { throw new Error('store should not be called') }
        eventAdapter.fetch = () => Promise.resolve(events)
        eventAdapter.storePack = () => { throw new Error('storePack should not be called') }

        manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue() as any)
      })

      it('should result in updated actor', async () => {
        const result = await manager.getOrCreate('account', 100, true)
        expect(result).toEqual({
          actor: actor,
          state: state,
          applied: events
        })
      })
    })

    describe('in readOnly with snapshotOnRead', () => {
      let manager: any
      let actor: any
      let state: any
      let events: any
      const id100 = flakes()
      beforeAll(() => {
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
        events = [{ id: 2 }, { id: 3 }]
        const instance = {
          actor: actor,
          state: state
        }
        actorAdapter.fetch = () => Promise.resolve(instance)
        actorAdapter.store = () => Promise.resolve({})
        eventAdapter.fetch = () => Promise.resolve(events)
        eventAdapter.storePack = () => Promise.resolve()

        manager = managerFn(actors, actorAdapter, eventAdapter, mockQueue() as any)
      })

      it('should result in updated actor', async () => {
        const result = await manager.getOrCreate('account', 100, true)
        expect(result).toEqual({
          actor: actor,
          state: state,
          applied: events
        })
      })
    })
  })
})
