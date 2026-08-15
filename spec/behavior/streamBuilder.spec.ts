import { describe, it, expect, beforeAll } from 'vitest'
import streamBuilder from '../../src/streamBuilder.js'

function* generator(list: any[]) {
  yield* list
}

// consequent-postgres's real adapter (pg-cursor-backed) resolves
// fetchStream to a genuine *async* iterable, not a sync generator -- this
// mock reproduces that shape directly, since a sync generator wrapped in a
// resolved Promise cannot catch a bare `for...of` (or a merge algorithm
// that isn't safe under true async interleaving) the way real Postgres
// usage did.
async function* asyncGenerator(list: any[]) {
  for (const item of list) yield item
}

describe('StreamBuilder', function () {
  describe('getEventStream', function () {
    describe('when using sinceDate', function () {
      let builder: any
      const options = {
        actorTypes: ['a', 'b', 'c'],
        since: Date.parse('01/30/2018')
      }
      let aEvents: any[]
      let bEvents: any[]
      let cEvents: any[]
      let events: any[] = []

      beforeAll(async function () {
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
            if (type === 'a') return Promise.resolve(generator(aEvents))
            if (type === 'b') return Promise.resolve(generator(bEvents))
            if (type === 'c') return Promise.resolve(generator(cEvents))
            return Promise.resolve(generator([]))
          }
        }

        const manager = {
          models: {
            a: { metadata: { actor: {} } },
            b: { metadata: { actor: {} } },
            c: { metadata: { actor: {} } }
          }
        }

        builder = streamBuilder(manager as any, null as any, null as any, mockEventAdapter as any)
        const stream = await builder.getEventStream('1', options)

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

    describe('when the event adapter resolves to an async iterable (real consequent-postgres shape)', function () {
      // Exact same fixture shape as the "when using sinceDate" case above
      // (3 types, 5/4/3 events) -- only the adapter mock differs (async
      // generator instead of sync), isolating the sync-vs-async concern.
      let builder: any
      let events: any[] = []

      beforeAll(async function () {
        const aEvents = [{ id: 'a1' }, { id: 'b1' }, { id: 'c1' }, { id: 'd1' }, { id: 'e1' }]
        const bEvents = [{ id: 'a2' }, { id: 'b2' }, { id: 'c2' }, { id: 'd2' }]
        const cEvents = [{ id: 'a3' }, { id: 'b3' }, { id: 'c3' }]

        const mockEventAdapter = {
          fetchStream: (type: string) => {
            if (type === 'a') return Promise.resolve(asyncGenerator(aEvents))
            if (type === 'b') return Promise.resolve(asyncGenerator(bEvents))
            if (type === 'c') return Promise.resolve(asyncGenerator(cEvents))
            return Promise.resolve(asyncGenerator([]))
          }
        }

        const manager = {
          models: {
            a: { metadata: { actor: {} } },
            b: { metadata: { actor: {} } },
            c: { metadata: { actor: {} } }
          }
        }

        builder = streamBuilder(manager as any, null as any, null as any, mockEventAdapter as any)
        const stream = await builder.getEventStream('1', { actorTypes: ['a', 'b', 'c'], since: Date.parse('01/30/2018') })

        events = []
        for (const event of stream) {
          events.push(event)
        }
      })

      it('should return all events in order, same as a sync generator would', function () {
        expect(events).toEqual([
          { id: 'a1' }, { id: 'a2' }, { id: 'a3' },
          { id: 'b1' }, { id: 'b2' }, { id: 'b3' },
          { id: 'c1' }, { id: 'c2' }, { id: 'c3' },
          { id: 'd1' }, { id: 'd2' }, { id: 'e1' }
        ])
      })
    })

    describe('when options.actors has multiple ids per type, all async (tower activity-feed shape)', function () {
      // The exact shape a caller merging several actors of the same type
      // uses (e.g. every `application` a tenant has) -- `options.actors:
      // { type: [id1, id2, ...] }`, not the single-id-per-type
      // `actorTypes` fallback the other two cases exercise. Previously
      // untested combination; this is exactly what hung against real
      // consequent-postgres before getEventStream was rewritten to drop
      // the unsafe-under-real-async-interleaving queue/depth merge.
      let builder: any
      let events: any[] = []

      beforeAll(async function () {
        const eventsById: Record<string, any[]> = {
          a1: [{ id: 'a1-1' }, { id: 'a1-2' }],
          a2: [{ id: 'a2-1' }],
          b1: [{ id: 'b1-1' }, { id: 'b1-2' }, { id: 'b1-3' }]
        }

        const mockEventAdapter = {
          fetchStream: (type: string, id: string) => Promise.resolve(asyncGenerator(eventsById[id] || []))
        }

        const manager = {
          models: {
            a: { metadata: { actor: {} } },
            b: { metadata: { actor: {} } }
          }
        }

        builder = streamBuilder(manager as any, null as any, null as any, mockEventAdapter as any)
        const stream = await builder.getEventStream('unused', {
          actors: { a: ['a1', 'a2'], b: ['b1'] },
          since: Date.parse('01/30/2018')
        })

        events = []
        for (const event of stream) {
          events.push(event)
        }
      })

      it('should return every id\'s events, merged and sorted by event id', function () {
        expect(events.map((e) => e.id)).toEqual(['a1-1', 'a1-2', 'a2-1', 'b1-1', 'b1-2', 'b1-3'])
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
            if (type === 'one') return Promise.resolve(generator(aEvents))
            if (type === 'two') return Promise.resolve(generator(bEvents))
            if (type === 'three') return Promise.resolve(generator(cEvents))
            return Promise.resolve(generator([]))
          }
        }

        const mockActorAdapter = {
          fetchByLastEventId: () => {},
          fetchByLastEventDate: (type: string, id: any, since: any) => Promise.resolve(baseline)
        }

        const manager = {
          models: {
            one: { metadata: { actor: { _actorTypes: ['one', 'two', 'three'] } } },
            two: { metadata: { actor: { _actorTypes: [] } } },
            three: { metadata: { actor: { _actorTypes: [] } } }
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
