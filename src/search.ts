import logFn from './log.js'
import type { AdapterLibrary, SearchAdapterInstance } from './types.js'

const log = logFn('consequent.search')

interface Manager {
  getOrCreate: (type: string, id: unknown) => Promise<unknown>
}

function getAdapter(adapters: Record<string, SearchAdapterInstance>, lib: AdapterLibrary<SearchAdapterInstance>, type: string): Promise<SearchAdapterInstance> {
  let adapter = adapters[type]
  if (!adapter) {
    const p = lib.create(type)
    return p.then(a => {
      adapters[type] = a
      return a
    })
  }
  return Promise.resolve(adapter)
}

function find(manager: Manager, adapters: Record<string, SearchAdapterInstance>, lib: AdapterLibrary<SearchAdapterInstance>, type: string, criteria: Record<string, unknown>): Promise<unknown[]> {
  return getAdapter(adapters, lib, type)
    .then(
      (search: SearchAdapterInstance) => {
        const ids = search.find(criteria)
        if (ids.length) {
          return Promise.all(
            ids.map((id: unknown) => manager.getOrCreate(type, id))
          )
        } else {
          return Promise.resolve([])
        }
      },
      onAdapterFailure.bind(null, type)
    )
}

function onAdapterFailure(type: string, err: Error): never {
  const error = `Failed to initialize search adapter for type '${type}' with ${err.stack}`
  log.error(error)
  throw new Error(error)
}

function update(adapters: Record<string, SearchAdapterInstance>, lib: AdapterLibrary<SearchAdapterInstance>, type: string, fieldList: string[], updated: Record<string, unknown>, original: Record<string, unknown>): Promise<void> {
  return getAdapter(adapters, lib, type)
    .then(
      (search: SearchAdapterInstance) => search.update(fieldList, updated, original),
      onAdapterFailure.bind(null, type)
    )
}

export default function (manager: Manager, searchLib: AdapterLibrary<SearchAdapterInstance>) {
  const adapters: Record<string, SearchAdapterInstance> = {}
  return {
    adapters: adapters,
    find: find.bind(null, manager, adapters, searchLib),
    update: update.bind(null, adapters, searchLib)
  }
}
