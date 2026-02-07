import type { AdapterLibrary, ActorCacheInstance } from '../types.js'

export default function (): AdapterLibrary<ActorCacheInstance> {
  return {
    create: () => {
      return Promise.resolve({
        fetch: () => Promise.resolve(undefined),
        getSystemId: () => Promise.resolve(undefined),
        mapIds: () => Promise.resolve(),
        store: () => Promise.resolve()
      })
    }
  }
}
