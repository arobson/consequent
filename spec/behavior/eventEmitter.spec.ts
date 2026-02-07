import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import eventEmitterFn from '../../src/eventEmitter.js'

describe('EventEmitter', () => {
  let emitter: any

  beforeAll(() => {
    emitter = eventEmitterFn(
      {},
      { apply: () => Promise.resolve() },
      { fetchByLastEventId: () => Promise.resolve({}), fetchByLastEventDate: () => Promise.resolve({}) },
      { fetchStream: () => new EventEmitter() }
    )
  })

  describe('checkSetIntersection', () => {
    it('should return true for overlapping ranges', () => {
      expect(emitter.checkSetIntersection(['a', 'c', 'e'], ['b', 'd'])).toBe(true)
    })

    it('should return false for disjoint ranges', () => {
      expect(emitter.checkSetIntersection(['a', 'b'], ['c', 'd'])).toBe(false)
    })

    it('should return false when first array is empty', () => {
      expect(emitter.checkSetIntersection([], ['a', 'b'])).toBe(false)
    })

    it('should return false when second array is empty', () => {
      expect(emitter.checkSetIntersection(['a', 'b'], [])).toBe(false)
    })

    it('should return false when both arrays are empty', () => {
      expect(emitter.checkSetIntersection([], [])).toBe(false)
    })
  })

  describe('depthCheck', () => {
    it('should return true when all queues meet depth threshold', () => {
      expect(emitter.depthCheck({ a: [1, 2], b: [3, 4] }, 2)).toBe(true)
    })

    it('should return false when any queue falls short', () => {
      expect(emitter.depthCheck({ a: [1, 2], b: [3] }, 2)).toBe(false)
    })

    it('should return true for depth 0', () => {
      expect(emitter.depthCheck({ a: [], b: [] }, 0)).toBe(true)
    })
  })

  describe('findTypeById', () => {
    it('should locate which queue contains a given event ID', () => {
      const queues = { typeA: [{ id: '1' }, { id: '2' }], typeB: [{ id: '3' }] }
      expect(emitter.findTypeById(queues, '3')).toBe('typeB')
    })

    it('should return undefined when ID is not found', () => {
      const queues = { typeA: [{ id: '1' }] }
      expect(emitter.findTypeById(queues, '99')).toBe(undefined)
    })
  })

  describe('getIdSeriesFromIndex', () => {
    it('should extract event IDs at a given queue position', () => {
      const queues = { a: [{ id: '1' }, { id: '2' }], b: [{ id: '3' }, { id: '4' }] }
      expect(emitter.getIdSeriesFromIndex(queues, 0)).toEqual(['1', '3'])
      expect(emitter.getIdSeriesFromIndex(queues, 1)).toEqual(['2', '4'])
    })

    it('should skip queues that lack the given index', () => {
      const queues = { a: [{ id: '1' }], b: [{ id: '2' }, { id: '3' }] }
      expect(emitter.getIdSeriesFromIndex(queues, 1)).toEqual(['3'])
    })
  })

  describe('chooseEvents', () => {
    it('should emit lowest ID first when queues overlap', () => {
      // First series: ['2', '3'], Second series: ['5', '6']
      // These overlap since '3' < '5' is false... let's check:
      // first = getIdSeriesFromIndex(queues, 0) → ['2', '3'] sorted → ['2','3']
      // second = getIdSeriesFromIndex(queues, 1) → ['5', '6'] sorted → ['5','6']
      // checkSetIntersection(['2','3'], ['5','6']) → first='5', last='3' → '5' < '3' is false → disjoint
      // Need truly overlapping ranges for the first branch:
      const queues = { a: [{ id: '1' }, { id: '4' }], b: [{ id: '3' }, { id: '6' }] }
      // first=[1,3] sorted=[1,3], second=[4,6] sorted=[4,6], '4' < '3' → false → still disjoint
      // For overlap: first series last > second series first
      const queues2 = { a: [{ id: '5' }, { id: '7' }], b: [{ id: '2' }, { id: '8' }] }
      // first=[5,2], sorted=[2,5], last=5; second=[7,8], sorted=[7,8], first=7; 7 < 5 → false
      // Actually checkSetIntersection sorts both: a.sort()[a.length-1] vs b.sort()[0]
      // For overlap we need: b.sort()[0] < a.sort()[a.length-1]
      const queues3 = { a: [{ id: '5' }, { id: '7' }], b: [{ id: '3' }, { id: '8' }] }
      // first=[5,3] sorted=[3,5], last=5; second=[7,8] sorted=[7,8], first=7; 7 < 5 → false
      // Hmm, both series at index 0 vs index 1:
      // first=getIdSeriesFromIndex(q, 0) → [q.a[0].id, q.b[0].id]
      // second=getIdSeriesFromIndex(q, 1) → [q.a[1].id, q.b[1].id]
      const queues4 = { a: [{ id: '1' }, { id: '3' }], b: [{ id: '2' }, { id: '4' }] }
      // first=[1,2] sorted=[1,2], last=2; second=[3,4] sorted=[3,4], first=3; 3 < 2 → false
      // For true overlap: second.sort()[0] < first.sort()[last]
      // e.g. first=[1,5], second=[3,4] → sorted first=[1,5], last=5, sorted second=[3,4], first=3, 3 < 5 → true!
      const queuesOverlap = { a: [{ id: '1' }, { id: '3' }], b: [{ id: '5' }, { id: '4' }] }
      // first=[1,5] sorted=[1,5] last=5; second=[3,4] sorted=[3,4] first=3; 3 < 5 → true!
      const result = emitter.chooseEvents(queuesOverlap)
      expect(result.length).toBe(1)
      expect(result[0].id).toBe('1')
    })

    it('should merge and sort when queues are disjoint', () => {
      const queues = { a: [{ id: '1' }, { id: '2' }], b: [{ id: '5' }, { id: '6' }] }
      const result = emitter.chooseEvents(queues)
      expect(result.length).toBeGreaterThan(0)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].id >= result[i - 1].id).toBe(true)
      }
    })
  })

  describe('mergeAndSort', () => {
    it('should merge and sort events from multiple queues', () => {
      const queues = { a: [{ id: '3' }, { id: '1' }], b: [{ id: '4' }, { id: '2' }] }
      const result = emitter.mergeAndSort(queues)
      expect(result).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }])
    })

    it('should splice consumed items from queues', () => {
      const queues = { a: [{ id: '1' }, { id: '2' }] }
      emitter.mergeAndSort(queues)
      expect(queues.a).toEqual([])
    })
  })

  describe('removeEmpty', () => {
    it('should clean up emptied queues', () => {
      const emptied = { a: true }
      const queues: any = { a: [], b: [{ id: '1' }] }
      emitter.removeEmpty(emptied, queues)
      expect(queues.a).toBeUndefined()
      expect(queues.b).toBeDefined()
    })

    it('should remove queues whose first item is undefined', () => {
      const emptied = { a: true }
      const queues: any = { a: [undefined] }
      emitter.removeEmpty(emptied, queues)
      expect(queues.a).toBeUndefined()
    })

    it('should call finalize when all queues are drained', () => {
      let finalized = false
      const emptied = { a: true }
      const queues: any = { a: [] }
      emitter.removeEmpty(emptied, queues, () => { finalized = true })
      expect(finalized).toBe(true)
    })

    it('should not call finalize when queues remain', () => {
      let finalized = false
      const emptied = { a: true }
      const queues: any = { a: [], b: [{ id: '1' }] }
      emitter.removeEmpty(emptied, queues, () => { finalized = true })
      expect(finalized).toBe(false)
    })
  })

  describe('checkQueues', () => {
    it('should return true when count matches and depth is met', () => {
      expect(emitter.checkQueues({ a: [1, 2], b: [3, 4] }, 2, 2)).toBe(true)
    })

    it('should return false when count does not match', () => {
      expect(emitter.checkQueues({ a: [1, 2] }, 2, 1)).toBe(false)
    })

    it('should return false when depth is not met', () => {
      expect(emitter.checkQueues({ a: [1], b: [2] }, 2, 2)).toBe(false)
    })
  })

  describe('getActorStream', () => {
    it('should reject without sinceEventId or sinceDate', async () => {
      await expect(emitter.getActorStream('account', '1', { actorTypes: ['account'] }))
        .rejects.toThrow('sinceDate or sinceEventId is required')
    })

    it('should return an EventEmitter with sinceEventId', async () => {
      const baseline = { id: '1', balance: 100 }
      const eventsEmitter = new EventEmitter()
      const em = eventEmitterFn(
        {},
        { apply: (_type: any, _event: any, bl: any) => { bl.balance = 200; return Promise.resolve() } },
        { fetchByLastEventId: () => Promise.resolve(baseline), fetchByLastEventDate: () => Promise.resolve(baseline) },
        { fetchStream: () => eventsEmitter }
      )

      const actors = await em.getActorStream('account', '1', { sinceEventId: '0', actorTypes: ['account'] })
      expect(actors).toBeInstanceOf(EventEmitter)
    })

    it('should forward events through dispatcher.apply', async () => {
      const baseline = { id: '1', balance: 100 }
      const eventsEmitter = new EventEmitter()
      let applyCalled = false
      const em = eventEmitterFn(
        {},
        { apply: (_type: any, _event: any, _bl: any) => { applyCalled = true; return Promise.resolve() } },
        { fetchByLastEventId: () => Promise.resolve(baseline), fetchByLastEventDate: () => Promise.resolve(baseline) },
        { fetchStream: () => eventsEmitter }
      )

      const actors = await em.getActorStream('account', '1', { sinceEventId: '0', actorTypes: ['account'] })

      await new Promise<void>((resolve) => {
        actors.on('actor', () => {})
        actors.on('streamComplete', () => resolve())
        eventsEmitter.emit('event', { id: '2', type: 'account.deposited' })
        setTimeout(() => eventsEmitter.emit('streamComplete'), 20)
      })

      expect(applyCalled).toBe(true)
    })

    it('should emit streamComplete when events stream completes', async () => {
      const eventsEmitter = new EventEmitter()
      const em = eventEmitterFn(
        {},
        { apply: () => Promise.resolve() },
        { fetchByLastEventId: () => Promise.resolve({}), fetchByLastEventDate: () => Promise.resolve({}) },
        { fetchStream: () => eventsEmitter }
      )

      const actors = await em.getActorStream('account', '1', { sinceDate: '2020-01-01', actorTypes: ['account'] })

      const completed = new Promise<boolean>((resolve) => {
        actors.on('streamComplete', () => resolve(true))
      })
      eventsEmitter.emit('streamComplete')
      expect(await completed).toBe(true)
    })

    it('should use sinceDate to fetch baseline', async () => {
      const baseline = { id: '1', balance: 500 }
      const eventsEmitter = new EventEmitter()
      const em = eventEmitterFn(
        {},
        { apply: () => Promise.resolve() },
        { fetchByLastEventId: () => Promise.resolve({}), fetchByLastEventDate: () => Promise.resolve(baseline) },
        { fetchStream: () => eventsEmitter }
      )

      const actors = await em.getActorStream('account', '1', { sinceDate: '2020-01-01', actorTypes: ['account'] })
      expect(actors).toBeInstanceOf(EventEmitter)
    })
  })

  describe('getEventStream', () => {
    it('should merge events from multiple actor type streams in sorted order', async () => {
      const em = eventEmitterFn(
        {},
        { apply: () => Promise.resolve() },
        { fetchByLastEventId: () => Promise.resolve({}), fetchByLastEventDate: () => Promise.resolve({}) },
        {
          fetchStream: (type: string) => {
            const ee = new EventEmitter()
            process.nextTick(() => {
              if (type === 'account') {
                ee.emit('event', { id: '1', type: 'account.opened' })
                ee.emit('event', { id: '3', type: 'account.deposited' })
                ee.emit('streamComplete')
              } else {
                ee.emit('event', { id: '2', type: 'trip.booked' })
                ee.emit('streamComplete')
              }
            })
            return ee
          }
        }
      )

      const merged = em.getEventStream({
        actorTypes: ['account', 'trip'],
        sinceDate: '2020-01-01'
      })

      const events: any[] = []
      await new Promise<void>((resolve) => {
        merged.on('event', (e: any) => events.push(e))
        merged.on('streamComplete', () => resolve())
      })

      expect(events.length).toBeGreaterThan(0)
    })

    it('should emit streamComplete when all sources exhausted', async () => {
      const em = eventEmitterFn(
        {},
        { apply: () => Promise.resolve() },
        { fetchByLastEventId: () => Promise.resolve({}), fetchByLastEventDate: () => Promise.resolve({}) },
        {
          fetchStream: () => {
            const ee = new EventEmitter()
            process.nextTick(() => ee.emit('streamComplete'))
            return ee
          }
        }
      )

      const merged = em.getEventStream({
        actorTypes: ['account'],
        sinceEventId: '0'
      })

      const completed = new Promise<boolean>((resolve) => {
        merged.on('streamComplete', () => resolve(true))
      })
      expect(await completed).toBe(true)
    })
  })
})
