import type { AdapterLibrary, EventCacheInstance } from '../types.js'

export default function (): AdapterLibrary<EventCacheInstance> {
  return {
    create: () => {
      return Promise.resolve({
        getEventsFor: () => {
          return Promise.resolve([])
        },
        getEventPackFor: () => {
          return Promise.resolve(undefined)
        },
        storeEvents: () => {
          return Promise.resolve()
        },
        storeEventPack: () => {
          return Promise.resolve()
        }
      })
    }
  }
}
