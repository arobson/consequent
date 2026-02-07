import { describe, it, expect, beforeAll } from 'vitest'
import streamBuilder from '../../src/streamBuilder.js'

const eventAdapter = {
  fetchStream: (...args: any[]) => ({} as any)
} as any

const actorAdapter = {
  fetchByLastEventId: () => {},
  fetchByLastEventDate: () => {},
} as any

function* generator(list: any[]) {
  yield* list
}

describe('StreamBuilder', function () {
  describe('checkQueues', function () {
    let builder: any

    beforeAll(function () {
      builder = streamBuilder()
    })

    it('should validate the number of queues and their depth', function () {
      expect(builder.checkQueues({}, 2, 2)).toBe(false)
      expect(builder.checkQueues({ a: [1, 2] }, 2, 2)).toBe(false)
      expect(builder.checkQueues({ a: [1, 2], b: [] }, 2, 2)).toBe(false)
      expect(builder.checkQueues({ a: [1, 2], b: [1] }, 2, 2)).toBe(false)
      expect(builder.checkQueues({ a: [1, 2], b: [1, 2] }, 2, 2)).toBe(true)
    })
  })

  describe('checkSetIntersection', function () {
    let builder: any

    beforeAll(function () {
      builder = streamBuilder()
    })

    it('should find intersections between sets', function () {
      expect(builder.checkSetIntersection([], [])).toBe(false)
      expect(builder.checkSetIntersection(['a', 'b', 'c'], [])).toBe(false)
      expect(builder.checkSetIntersection(['a', 'b', 'c'], ['d'])).toBe(false)
      expect(builder.checkSetIntersection(['a', 'b', 'd'], ['c'])).toBe(true)
      expect(builder.checkSetIntersection(['d', 'a', 'g'], ['b', 'k', 'l'])).toBe(true)
    })
  })

  describe('chooseEvents', function () {
    let builder: any

    beforeAll(function () {
      builder = streamBuilder()
    })

    describe('when one queue has events with lower ids', function () {
      let queues: any
      let events: any
      beforeAll(function () {
        queues = {
          a: [{ id: 'cd' }, { id: 'ce' }],
          b: [{ id: 'aa' }, { id: 'ab' }],
          c: [{ id: 'fg' }, { id: 'fh' }]
        }

        events = builder.chooseEvents(queues)
      })

      it('should only return one event', function () {
        expect(events.length).toBe(1)
        expect(events).toEqual([
          { id: 'aa' }
        ])
      })

      it('should remove the event returned', function () {
        expect(queues.b.length).toBe(1)
        expect(queues.b).toEqual([
          { id: 'ab' }
        ])
      })
    })

    describe('when queue event ids do not intersect', function () {
      let queues: any
      let events: any
      beforeAll(function () {
        queues = {
          a: [{ id: 'ab' }, { id: 'bg' }],
          b: [{ id: 'af' }, { id: 'bb' }],
          c: [{ id: 'ac' }, { id: 'bh' }]
        }

        events = builder.chooseEvents(queues)
      })

      it('should return ordered events', function () {
        expect(events.length).toBe(6)
        expect(events).toEqual([
          { id: 'ab' },
          { id: 'ac' },
          { id: 'af' },
          { id: 'bb' },
          { id: 'bg' },
          { id: 'bh' }
        ])
      })

      it('should return emptied queues', function () {
        expect(queues).toEqual({
          a: [],
          b: [],
          c: []
        })
      })
    })
  })

  describe('getEventStream', function () {
    describe('when using sinceDate', function () {
      let builder: any
      const options = {
        actorTypes: ['a', 'b', 'c'],
        since: Date.parse('01/30/2018')
      }
      const eventOptions = {
        since: options.since,
        sinceId: undefined,
        until: undefined,
        untilId: undefined,
        filter: undefined
      }
      let aEvents: any[]
      let bEvents: any[]
      let cEvents: any[]
      let events: any[] = []

      beforeAll(function () {
        aEvents = [
          { id: 'a1' },
          { id: 'b1' },
          { id: 'c1' },
          { id: 'd1' },
          { id: 'e1' }
        ]

        bEvents = [
          { id: 'a2' },
          { id: 'b2' },
          { id: 'c2' },
          { id: 'd2' }
        ]

        cEvents = [
          { id: 'a3' },
          { id: 'b3' },
          { id: 'c3' }
        ]

        const mockEventAdapter = {
          fetchStream: (type: string, id: any, opts: any) => {
            if (type === 'a') return generator(aEvents)
            if (type === 'b') return generator(bEvents)
            if (type === 'c') return generator(cEvents)
            return generator([])
          }
        }

        const manager = {
          models: {
            a: { actor: {} },
            b: { actor: {} },
            c: { actor: {} }
          }
        }

        builder = streamBuilder(manager as any, null as any, null as any, mockEventAdapter as any)
        const stream = builder.getEventStream('1', options)

        events = []
        for (const event of stream) {
          events.push(event)
        }
      })

      it('should return all events in order', function () {
        expect(events).toEqual([
          { id: 'a1' },
          { id: 'a2' },
          { id: 'a3' },
          { id: 'b1' },
          { id: 'b2' },
          { id: 'b3' },
          { id: 'c1' },
          { id: 'c2' },
          { id: 'c3' },
          { id: 'd1' },
          { id: 'd2' },
          { id: 'e1' }
        ])
      })
    })
  })

  describe('getActorStream', function () {
    describe('when using sinceDate', function () {
      let builder: any
      const options = {
        since: Date.parse('01/30/2018'),
        eventTypes: ['three.3', 'one.6']
      }
      let aEvents: any[]
      let bEvents: any[]
      let cEvents: any[]
      const baseline = {
        actor: { type: 'one' },
        state: {
          events: [] as any[]
        }
      }
      let timeline: any[] = []

      beforeAll(async function () {
        aEvents = [
          { id: 'a1', type: 'one.1' },
          { id: 'b1', type: 'one.4' },
          { id: 'c1', type: 'one.6' },
        ]

        bEvents = [
          { id: 'a2', type: 'two.2' },
          { id: 'b2', type: 'two.5' },
        ]

        cEvents = [
          { id: 'a3', type: 'three.3' },
        ]

        const mockEventAdapter = {
          fetchStream: (type: string, id: any, opts: any) => {
            if (type === 'one') return generator(aEvents)
            if (type === 'two') return generator(bEvents)
            if (type === 'three') return generator(cEvents)
            return generator([])
          }
        }

        const mockActorAdapter = {
          fetchByLastEventId: () => {},
          fetchByLastEventDate: (id: any, since: any) => Promise.resolve(baseline)
        }

        const manager = {
          models: {
            one: { actor: { _actorTypes: ['one', 'two', 'three'] } },
            two: { actor: { _actorTypes: [] } },
            three: { actor: { _actorTypes: [] } }
          },
          getSourceIds: function () {
            return '2'
          }
        }

        const dispatcher = {
          apply: (type: string, event: any, baseline: any) => {
            baseline.state.events.push(event)
          }
        }

        builder = streamBuilder(manager as any, dispatcher as any, mockActorAdapter as any, mockEventAdapter as any)
        const stream = builder.getActorStream('one', '1', options)

        timeline = []
        for await (const instance of stream) {
          timeline.push(instance)
        }
      })

      it('should emit copies of state', function () {
        expect(timeline).toEqual([
          { events: [] },
          {
            events: [
              { id: 'a1', type: 'one.1' },
              { id: 'a2', type: 'two.2' },
              { id: 'a3', type: 'three.3' }
            ]
          },
          {
            events: [
              { id: 'a1', type: 'one.1' },
              { id: 'a2', type: 'two.2' },
              { id: 'a3', type: 'three.3' },
              { id: 'b1', type: 'one.4' },
              { id: 'b2', type: 'two.5' },
              { id: 'c1', type: 'one.6' }
            ]
          }
        ])
      })
    })
  })
})
