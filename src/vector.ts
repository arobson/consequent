import clock from 'vectorclock'
import type { VectorClock } from './types.js'

export function increment(vector: VectorClock, nodeId: string): void {
  clock.increment(vector, nodeId)
}

export function parse(vector: string): VectorClock {
  const pairs = vector.split(';')
  return pairs.reduce((acc: VectorClock, pair) => {
    if (pair) {
      const kvp = pair.split(':')
      acc[kvp[0]] = parseInt(kvp[1])
    }
    return acc
  }, {})
}

export function stringify(vector: VectorClock): string {
  const keys = Object.keys(vector)
  const pairs = keys.sort().map((key) => {
    return `${key}:${vector[key]}`
  })
  return pairs.join(';')
}

export function toVersion(vector: string): number {
  const clocks = vector.split(';')
  return clocks.reduce((version, clock) => {
    if (clock) {
      const parts = clock.split(':')
      return version + parseInt(parts[1])
    }
    return version
  }, 0)
}
