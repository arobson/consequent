import { describe, it, expect } from 'vitest'
import buildSearch from '../../src/search.js'

// A real, DB-backed search adapter's `find` is necessarily async (it has to
// make a network call). The built-in in-memory default's `find` is
// synchronous. buildSearch's own `find` wrapper must handle both -- it
// previously checked `.length` directly on whatever `adapter.find()`
// returned, which silently treated an unresolved Promise as an empty
// array for every async adapter (a Promise has no `.length`).

function fakeManager () {
  const fetched: unknown[] = []
  return {
    fetched,
    getOrCreate: (type: string, id: unknown) => {
      fetched.push(id)
      return Promise.resolve({ type, id, state: { id } })
    }
  }
}

function fakeLib (adapter: { find: (criteria: Record<string, unknown>) => unknown }) {
  return {
    create: (_type: string) => Promise.resolve(adapter)
  }
}

describe('search find()', () => {
  it('resolves matches from a synchronous adapter (the in-memory default shape)', async () => {
    const manager = fakeManager()
    const lib = fakeLib({ find: () => ['id-1', 'id-2'] })
    const search = buildSearch(manager, lib as any)

    const results = await search.find('account', { status: 'active' })

    expect(results).toHaveLength(2)
    expect(manager.fetched).toEqual(['id-1', 'id-2'])
  })

  it('awaits and resolves matches from an asynchronous adapter (a real, DB-backed shape)', async () => {
    const manager = fakeManager()
    const lib = fakeLib({ find: () => Promise.resolve(['id-1', 'id-2']) })
    const search = buildSearch(manager, lib as any)

    const results = await search.find('account', { status: 'active' })

    expect(results).toHaveLength(2)
    expect(manager.fetched).toEqual(['id-1', 'id-2'])
  })

  it('resolves an empty array from an asynchronous adapter with no matches, not a truthy Promise', async () => {
    const manager = fakeManager()
    const lib = fakeLib({ find: () => Promise.resolve([]) })
    const search = buildSearch(manager, lib as any)

    const results = await search.find('account', { status: 'nonexistent' })

    expect(results).toEqual([])
    expect(manager.fetched).toEqual([])
  })
})
