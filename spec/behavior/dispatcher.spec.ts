import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fd from 'fauxdash'
import dispatcherFn from '../../src/dispatch.js'
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

function mockManager(type?: string, id?: any, result?: any, calls?: number) {
  const manager = {
    getOrCreate: () => {},
    storeEvents: () => {}
  } as any
  if (type) {
    if (result && result instanceof Error) {
      manager.getOrCreate = () => Promise.reject(result)
    } else {
      manager.getOrCreate = () => Promise.resolve(result)
    }
  } else {
    manager.getOrCreate = () => { throw new Error('getOrCreate should not be called') }
  }
  return manager
}

function mockSearch(type?: string, fields?: string[], results?: any[], err?: any) {
  const search = {
    update: () => Promise.resolve()
  } as any
  return search
}

describe('Dispatch', () => {
  describe('when dispatching unmatched topic', function () {
    let dispatcher: any

    beforeAll(async () => {
      const queue = mockQueue()
      const manager = mockManager()
      const lookup = {}
      const search = mockSearch()
      dispatcher = dispatcherFn(flakes, lookup, manager, search, {} as any, queue as any)
    })

    it('should not queue a task', async () => {
      const result = await dispatcher.handle('badid', 'nomatch', {})
      expect(result).toEqual([])
    })
  })

  describe('dispatching with manager error', function () {
    let dispatcher: any

    beforeAll(() => {
      const actors = {
        test: {
          metadata: {
            actor: {
              type: 'test'
            },
            commands: {
              doAThing: [[]]
            }
          }
        }
      }
      const queue = mockQueue()
      const manager = mockManager('test', 100, new Error(':('))
      const lookup = { doAThing: ['test'] }
      const search = mockSearch()
      dispatcher = dispatcherFn(flakes, lookup, manager, search, actors as any, queue as any)
    })

    it('should not queue a task', async () => {
      await expect(dispatcher.handle(100, 'doAThing', {}))
        .rejects.toThrow("Failed to instantiate actor 'test'")
    })
  })

  describe('dispatching to existing actor', function () {
    let actors: any
    let instance: any
    let command: any
    let event: any
    let results: any
    let dispatcher: any

    beforeAll(async function () {
      command = { type: 'test.doAThing', thing: { howMuch: 'totes mcgoats' } }
      event = { type: 'test.thingDid', did: { degree: 'totes mcgoats' } }
      const metadata = {
        test: {
          actor: {
            type: 'test',
            searchableBy: ['doneDidfulness'],
            identifiedBy: 'id'
          },
          state: {},
          commands: {
            doAThing: [
              [
                (actor: any) => actor.canDo,
                (actor: any, thing: any) => [{ type: 'test.thingDid', did: { degree: thing.howMuch } }]
              ]
            ]
          },
          events: {
            thingDid: [
              [true, (actor: any, did: any) => {
                actor.doneDidfulness = did.degree
              }]
            ]
          }
        }
      }
      const queue = {
        add: (id: any, fn: any) => Promise.resolve(fn())
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

      const list = await loader(fount, metadata as any)
      actors = list
      instance = fd.clone(actors.test.metadata)
      instance.state = { id: 100, canDo: true }
      const manager = mockManager('test', 100, instance, 2)
      const lookup = {
        'test.doAThing': ['test'],
        'test.thingDid': ['test']
      }

      const search = mockSearch()
      dispatcher = dispatcherFn(flakes, lookup, manager, search, actors, queue as any)
    })

    it('should queue the command successfully', async function () {
      const result = await dispatcher.handle(100, 'test.doAThing', command)
      expect(result).toPartiallyEqual(results)
    })

    it('should queue the event successfully', async function () {
      const result = await dispatcher.handle(100, 'test.thingDid', event)
      expect(result).toEqual([])
    })

    it('should mutate actor state', function () {
      expect(instance.state.doneDidfulness).toEqual('totes mcgoats')
    })
  })
})
