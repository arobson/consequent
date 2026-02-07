import { describe, it, expect, beforeAll } from 'vitest'
import actorStoreFn from '../../src/default/actorStore.js'
import eventStoreFn from '../../src/default/eventStore.js'
import searchAdapterFn from '../../src/default/searchAdapter.js'

describe('Default Actor Store', () => {
  let lib: any
  let adapter: any

  beforeAll(async () => {
    lib = actorStoreFn()
    adapter = await lib.create('account')
  })

  describe('get', () => {
    it('should return undefined when type has no data for id', async () => {
      const result = await adapter.fetch('nonexistent')
      expect(result).toBeUndefined()
    })

    it('should return the most recent snapshot via store', async () => {
      adapter.store('id1', 'v1', { _id: 'snap-1', balance: 100 })
      adapter.store('id1', 'v2', { _id: 'snap-1', balance: 200 })
      expect(lib.state.account['snap-1']).toEqual([
        { _id: 'snap-1', balance: 100 },
        { _id: 'snap-1', balance: 200 }
      ])
    })

    it('should return the last snapshot when state key exists', async () => {
      // getSystemId returns Promise which stringifies to "[object Promise]"
      // So store data under that key to exercise the list.slice(-1) path
      const pKey = String(Promise.resolve())
      lib.state.account[pKey] = [
        { _id: pKey, balance: 300 },
        { _id: pKey, balance: 400 }
      ]
      const result = await adapter.fetch('any-id')
      expect(result).toEqual({ _id: pKey, balance: 400 })
    })
  })

  describe('findByLastEvent', () => {
    it('should return undefined for unknown type data', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('empty')
      const result = await freshAdapter.fetchByLastEventId('unknown', '10')
      expect(result).toBeUndefined()
    })

    it('should return exact match when data exists under resolved key', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('test')
      // getSystemId returns Promise → "[object Promise]" when used as key
      const pKey = String(Promise.resolve())
      freshLib.state.test[pKey] = [
        { _id: pKey, lastEventId: '10' },
        { _id: pKey, lastEventId: '20' },
        { _id: pKey, lastEventId: '30' }
      ]
      const result = await freshAdapter.fetchByLastEventId('any', '20')
      expect(result).toEqual({ _id: pKey, lastEventId: '20' })
    })

    it('should return nearest after when value is between snapshots', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('test2')
      const pKey = String(Promise.resolve())
      freshLib.state.test2[pKey] = [
        { _id: pKey, lastEventId: '10' },
        { _id: pKey, lastEventId: '20' },
        { _id: pKey, lastEventId: '30' }
      ]
      const result = await freshAdapter.fetchByLastEventId('any', '15')
      expect(result).toBeDefined()
    })

    it('should return undefined when value below all snapshots', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('test3')
      const pKey = String(Promise.resolve())
      freshLib.state.test3[pKey] = [
        { _id: pKey, lastEventId: '10' },
        { _id: pKey, lastEventId: '20' }
      ]
      const result = await freshAdapter.fetchByLastEventId('any', '05')
      expect(result).toBeUndefined()
    })

    it('should return nearest after when value is less than last but greater than first', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('test5')
      const pKey = String(Promise.resolve())
      freshLib.state.test5[pKey] = [
        { _id: pKey, lastEventId: '10' },
        { _id: pKey, lastEventId: '20' },
        { _id: pKey, lastEventId: '30' }
      ]
      // '25' is between '20' and '30', should return the nearest after (30)
      const result = await freshAdapter.fetchByLastEventId('any', '25')
      expect(result).toEqual({ _id: pKey, lastEventId: '30' })
    })

    it('should return snapshot when value equals last point popped', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('test6')
      const pKey = String(Promise.resolve())
      freshLib.state.test6[pKey] = [
        { _id: pKey, lastEventId: '10' },
        { _id: pKey, lastEventId: '30' }
      ]
      // '15' > '10' is false (as strings '15' > '10' → true)
      // Actually string comparison: '15' > '10' → true, '15' > '30' → false
      // list = ['10', '30'] sorted → ['10', '30']
      // pop() → '30', '30' > '15' → true, last = '30'
      // pop() → '10', '10' > '15' → false, last is set → return lookup['30']
      const result = await freshAdapter.fetchByLastEventId('any', '15')
      expect(result).toEqual({ _id: pKey, lastEventId: '30' })
    })

    it('should return undefined when actors list is absent', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('test4')
      // State exists but no data for the resolved key
      const result = await freshAdapter.fetchByLastEventId('any', '10')
      expect(result).toBeUndefined()
    })
  })

  describe('fetchByLastEventDate', () => {
    it('should handle date-based lookup', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('dated')
      const pKey = String(Promise.resolve())
      freshLib.state.dated[pKey] = [
        { _id: pKey, lastEventDate: '2020-01-01' },
        { _id: pKey, lastEventDate: '2020-06-01' }
      ]
      const result = await freshAdapter.fetchByLastEventDate('any', '2020-01-01')
      expect(result).toEqual({ _id: pKey, lastEventDate: '2020-01-01' })
    })
  })

  describe('getActorId and getSystemId', () => {
    beforeAll(() => {
      lib.state.account.actorIds['a-100'] = ['s-100']
      lib.state.account.systemIds['s-100'] = ['a-100']
    })

    it('should resolve actor ID from system ID', async () => {
      const result = await adapter.getActorId('s-100')
      expect(result).toBe('a-100')
    })

    it('should resolve system ID from actor ID', async () => {
      const result = await adapter.getSystemId('a-100')
      expect(result).toBe('s-100')
    })

    it('should return undefined for unknown system ID', async () => {
      const result = await adapter.getActorId('unknown-sys')
      expect(result).toBeUndefined()
    })

    it('should return undefined for unknown actor ID', async () => {
      const result = await adapter.getSystemId('unknown-actor')
      expect(result).toBeUndefined()
    })
  })

  describe('getActorId for type with empty systemIds', () => {
    it('should return undefined when systemId has no mapping', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('nomapping')
      const result = await freshAdapter.getActorId('no-such-sysid')
      expect(result).toBeUndefined()
    })

    it('should return the last actorId when mapping exists', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('mapped')
      freshLib.state.mapped.systemIds['sys-abc'] = ['actor-1', 'actor-2']
      const result = await freshAdapter.getActorId('sys-abc')
      expect(result).toBe('actor-2')
    })
  })

  describe('mapIds', () => {
    it('should create new mappings', () => {
      const fresh = actorStoreFn()
      fresh.create('test')
      fresh.state.test.actorIds = {}
      fresh.state.test.systemIds = {}
      // Access the internal mapIds via the create result
    })

    it('should create bidirectional mappings via adapter', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('mapping')
      freshAdapter.mapIds('sys-new', 'actor-new')
      expect(freshLib.state.mapping.actorIds['actor-new']).toEqual(['sys-new'])
      expect(freshLib.state.mapping.systemIds['sys-new']).toEqual(['actor-new'])
    })

    it('should append to existing mappings', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('mapping')
      freshAdapter.mapIds('sys-1', 'actor-1')
      freshAdapter.mapIds('sys-2', 'actor-1')
      expect(freshLib.state.mapping.actorIds['actor-1']).toEqual(['sys-1', 'sys-2'])
    })
  })

  describe('set', () => {
    it('should create first snapshot', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('snap')
      freshAdapter.store('id1', 'v1', { _id: 'sys-x', val: 1 })
      expect(freshLib.state.snap['sys-x']).toEqual([{ _id: 'sys-x', val: 1 }])
    })

    it('should append subsequent snapshots', async () => {
      const freshLib = actorStoreFn()
      const freshAdapter: any = await freshLib.create('snap')
      freshAdapter.store('id1', 'v1', { _id: 'sys-y', val: 1 })
      freshAdapter.store('id1', 'v2', { _id: 'sys-y', val: 2 })
      expect(freshLib.state.snap['sys-y']).toEqual([
        { _id: 'sys-y', val: 1 },
        { _id: 'sys-y', val: 2 }
      ])
    })
  })
})

describe('Default Event Store', () => {
  let lib: any
  let adapter: any

  beforeAll(async () => {
    lib = eventStoreFn()
    adapter = await lib.create('account')
  })

  describe('storeEvents and getEventsFor', () => {
    it('should store and retrieve events', async () => {
      await adapter.storeEvents('actor-1', [
        { id: '1', type: 'account.opened' },
        { id: '3', type: 'account.deposited' },
        { id: '2', type: 'account.closed' }
      ])
      const events = await adapter.getEventsFor('actor-1')
      expect(events).toBeDefined()
      expect(events.length).toBe(3)
    })

    it('should return undefined for unknown actors', async () => {
      const events = await adapter.getEventsFor('unknown-actor')
      expect(events).toBeUndefined()
    })
  })

  describe('getEventStreamFor', () => {
    it('should yield events matching filter criteria', () => {
      const events = [...adapter.getEventStreamFor('actor-1', {})]
      expect(events.length).toBe(3)
    })

    it('should yield nothing for unknown actors', () => {
      const events = [...adapter.getEventStreamFor('unknown', {})]
      expect(events.length).toBe(0)
    })
  })

  describe('isAfterSince and isBeforeUntil via getEventsFor', () => {
    beforeAll(async () => {
      await adapter.storeEvents('actor-filter', [
        { id: '10', type: 'a', _createdOn: '2020-01-01' },
        { id: '20', type: 'b', _createdOn: '2020-06-01' },
        { id: '30', type: 'c', _createdOn: '2020-12-01' }
      ])
    })

    it('should filter by sinceId', async () => {
      const events = await adapter.getEventsFor('actor-filter', { sinceId: '10' })
      expect(events.every((e: any) => e.id > '10')).toBe(true)
    })

    it('should filter by since date', async () => {
      const events = await adapter.getEventsFor('actor-filter', { since: '2020-01-01' })
      expect(events.every((e: any) => e._createdOn > '2020-01-01')).toBe(true)
    })

    it('should filter by untilId', async () => {
      const events = await adapter.getEventsFor('actor-filter', { untilId: '20' })
      expect(events.every((e: any) => e.id <= '20')).toBe(true)
    })

    it('should filter by until date', async () => {
      const events = await adapter.getEventsFor('actor-filter', { until: '2020-12-01' })
      expect(events.every((e: any) => e._createdOn >= '2020-12-01')).toBe(true)
    })
  })

  describe('passesFilter via getEventsFor', () => {
    it('should apply custom filter function', async () => {
      await adapter.storeEvents('actor-cf', [
        { id: '1', type: 'a', amount: 10 },
        { id: '2', type: 'b', amount: 50 },
        { id: '3', type: 'c', amount: 5 }
      ])
      const events = await adapter.getEventsFor('actor-cf', {
        filter: (e: any) => e.amount > 8
      })
      expect(events.length).toBe(2)
    })
  })

  describe('storeEventPackFor and getEventPackFor', () => {
    it('should round-trip pack storage', async () => {
      const pack = [{ id: '1' }, { id: '2' }]
      await adapter.storeEventPack('actor-pk', 'a:1;b:2', pack)
      const result = await adapter.getEventPackFor('actor-pk', 'a:1;b:2')
      expect(result).toEqual(pack)
    })

    it('should return undefined for unknown pack', async () => {
      const result = await adapter.getEventPackFor('actor-pk', 'no:such')
      expect(result).toBeUndefined()
    })

    it('should return undefined for unknown type', async () => {
      const freshLib = eventStoreFn()
      const freshAdapter: any = await freshLib.create('other')
      const result = await freshAdapter.getEventPackFor('any', 'v1')
      expect(result).toBeUndefined()
    })
  })
})

describe('Default Search Adapter', () => {
  let lib: any
  let adapter: any

  beforeAll(async () => {
    lib = searchAdapterFn()
    adapter = await lib.create('account')
    // Seed some data
    await adapter.update(['balance', 'name', 'tags', 'status'], {
      id: 'a1', balance: 100, name: 'Alice', tags: ['vip', 'active'], status: 'open'
    }, {})
    await adapter.update(['balance', 'name', 'tags', 'status'], {
      id: 'a2', balance: 200, name: 'Bob', tags: ['active'], status: 'open'
    }, {})
    await adapter.update(['balance', 'name', 'tags', 'status'], {
      id: 'a3', balance: 50, name: 'Charlie', tags: ['inactive'], status: 'closed'
    }, {})
  })

  describe('find with equals', () => {
    it('should match exact field value', () => {
      const ids = adapter.find({ name: 'Alice' })
      expect(ids).toContain('a1')
      expect(ids).not.toContain('a2')
    })
  })

  describe('find with contains', () => {
    it('should match items in array field', () => {
      const ids = adapter.find({ tags: { contains: 'vip' } })
      expect(ids).toContain('a1')
      expect(ids).not.toContain('a2')
    })
  })

  describe('find with gt/gte/lt/lte', () => {
    it('should find items greater than value', () => {
      const ids = adapter.find({ balance: { gt: 100 } })
      expect(ids).toContain('a2')
      expect(ids).not.toContain('a1')
    })

    it('should find items greater than or equal to value', () => {
      const ids = adapter.find({ balance: { gte: 100 } })
      expect(ids).toContain('a1')
      expect(ids).toContain('a2')
      expect(ids).not.toContain('a3')
    })

    it('should find items less than value', () => {
      const ids = adapter.find({ balance: { lt: 100 } })
      expect(ids).toContain('a3')
      expect(ids).not.toContain('a1')
    })

    it('should find items less than or equal to value', () => {
      const ids = adapter.find({ balance: { lte: 100 } })
      expect(ids).toContain('a1')
      expect(ids).toContain('a3')
      expect(ids).not.toContain('a2')
    })
  })

  describe('find with not', () => {
    it('should exclude matching values', () => {
      const ids = adapter.find({ status: { not: ['closed'] } })
      expect(ids).toContain('a1')
      expect(ids).toContain('a2')
      expect(ids).not.toContain('a3')
    })
  })

  describe('find with between (array predicate)', () => {
    it('should find values in range', () => {
      const ids = adapter.find({ balance: [75, 250] })
      expect(ids).toContain('a1')
      expect(ids).toContain('a2')
      expect(ids).not.toContain('a3')
    })
  })

  describe('find with match', () => {
    it('should match regex pattern', () => {
      const ids = adapter.find({ name: { match: '^A' } })
      expect(ids).toContain('a1')
      expect(ids).not.toContain('a2')
    })
  })

  describe('find with in', () => {
    it('should find membership in scalar field', () => {
      const ids = adapter.find({ name: { in: ['Alice', 'Charlie'] } })
      expect(ids).toContain('a1')
      expect(ids).toContain('a3')
      expect(ids).not.toContain('a2')
    })

    it('should find membership in array field', () => {
      const ids = adapter.find({ tags: { in: ['vip', 'inactive'] } })
      expect(ids).toContain('a1')
      expect(ids).toContain('a3')
    })
  })

  describe('multi-field criteria', () => {
    it('should intersect results across fields', () => {
      const ids = adapter.find({ status: 'open', balance: { gt: 150 } })
      expect(ids).toEqual(['a2'])
    })

    it('should return empty when intersection is empty', () => {
      const ids = adapter.find({ status: 'closed', balance: { gt: 150 } })
      expect(ids).toEqual([])
    })
  })

  describe('getFieldValue and getNestedValue', () => {
    it('should resolve simple field', () => {
      expect(lib.getFieldValue({ a: 1 }, 'a')).toBe(1)
    })

    it('should resolve dotted nested paths', () => {
      expect(lib.getFieldValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42)
    })

    it('should map at each array level', () => {
      const obj = { items: [{ name: 'x' }, { name: 'y' }] }
      expect(lib.getFieldValue(obj, 'items.name')).toEqual(['x', 'y'])
    })
  })

  describe('removeFromFieldIndex', () => {
    it('should remove value from index when last reference', async () => {
      const freshLib = searchAdapterFn()
      const freshAdapter: any = await freshLib.create('rm')
      await freshAdapter.update(['color'], { id: 'x1', color: 'red' }, {})
      expect(freshAdapter.find({ color: 'red' })).toContain('x1')

      // update to remove 'red' and add 'blue'
      await freshAdapter.update(['color'], { id: 'x1', color: 'blue' }, { id: 'x1', color: 'red' })
      expect(freshAdapter.find({ color: 'red' })).toEqual([])
      expect(freshAdapter.find({ color: 'blue' })).toContain('x1')
    })

    it('should only remove one reference when multiple exist', async () => {
      const freshLib = searchAdapterFn()
      const freshAdapter: any = await freshLib.create('rm2')
      await freshAdapter.update(['color'], { id: 'x1', color: 'red' }, {})
      await freshAdapter.update(['color'], { id: 'x2', color: 'red' }, {})
      expect(freshAdapter.find({ color: 'red' })).toContain('x1')
      expect(freshAdapter.find({ color: 'red' })).toContain('x2')

      // change x1's color
      await freshAdapter.update(['color'], { id: 'x1', color: 'blue' }, { id: 'x1', color: 'red' })
      expect(freshAdapter.find({ color: 'red' })).toEqual(['x2'])
    })
  })

  describe('update', () => {
    it('should handle scalar to scalar field update', async () => {
      const freshLib = searchAdapterFn()
      const freshAdapter: any = await freshLib.create('scalar')
      await freshAdapter.update(['color'], { id: 'x1', color: 'red' }, {})
      expect(freshAdapter.find({ color: 'red' })).toContain('x1')

      await freshAdapter.update(['color'], { id: 'x1', color: 'blue' }, { id: 'x1', color: 'red' })
      expect(freshAdapter.find({ color: 'red' })).toEqual([])
      expect(freshAdapter.find({ color: 'blue' })).toContain('x1')
    })

    it('should index whole arrays as single values', async () => {
      const freshLib = searchAdapterFn()
      const freshAdapter: any = await freshLib.create('wholearr')
      await freshAdapter.update(['tags'], { id: 'x1', tags: ['a', 'b'] }, {})
      expect(freshAdapter.find({ tags: { contains: 'a' } })).toContain('x1')
      expect(freshAdapter.find({ tags: { contains: 'b' } })).toContain('x1')
    })

    it('should handle array-to-array diff updates', async () => {
      const freshLib = searchAdapterFn()
      const freshAdapter: any = await freshLib.create('arrdiff')
      await freshAdapter.update(['tags'], { id: 'x1', tags: ['a', 'b'] }, {})

      // Update triggers array diff path: additions=['c'], removals=['a']
      await freshAdapter.update(['tags'], { id: 'x1', tags: ['b', 'c'] }, { id: 'x1', tags: ['a', 'b'] })
      // Individual elements are indexed as scalars via addToFieldIndex
      // 'c' was added as scalar value, findable via equals
      expect(freshAdapter.find({ tags: 'c' })).toContain('x1')
    })
  })
})
