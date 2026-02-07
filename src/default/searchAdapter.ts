import fd from 'fauxdash'
const { intersection, without, map: mapObject, reduce: reduceObject } = fd
import type { AdapterLibrary, SearchAdapterInstance } from '../types.js'

interface FieldIndex {
  values: unknown[]
  ids: Record<string, unknown[]>
}

type SearchState = Record<string, Record<string, FieldIndex>>

function addToFieldIndex(fieldIndex: FieldIndex, id: unknown, value: unknown): void {
  if (value) {
    const key = value as string
    if (!fieldIndex.ids[key]) {
      fieldIndex.ids[key] = []
    }
    fieldIndex.ids[key].push(id)
    if (fieldIndex.values.indexOf(value) < 0) {
      fieldIndex.values.push(value)
      fieldIndex.values.sort()
    }
  }
}

function removeFromFieldIndex(fieldIndex: FieldIndex, id: unknown, value: unknown): void {
  const key = value as string
  const ids = fieldIndex.ids[key]
  if (ids && ids.length === 1) {
    const index = fieldIndex.values.indexOf(value)
    fieldIndex.values.splice(index, 1)
    fieldIndex.ids[key] = []
  } else if (fieldIndex.ids[key] && fieldIndex.ids[key].length > 0) {
    const index = fieldIndex.ids[key].indexOf(id)
    fieldIndex.ids[key].splice(index, 1)
  }
}

function addFieldValue(state: SearchState, type: string, id: unknown, field: string, before: unknown, after: unknown): void {
  if (Array.isArray(before) && Array.isArray(after)) {
    const fieldIndex = getFieldIndex(state, type, field)
    const additions = without(after, before)
    const removals = without(before, after)
    additions.forEach(add => addToFieldIndex(fieldIndex, id, add))
    removals.forEach(remove => removeFromFieldIndex(fieldIndex, id, remove))
  } else {
    const fieldIndex = getFieldIndex(state, type, field)
    removeFromFieldIndex(fieldIndex, id, before)
    addToFieldIndex(fieldIndex, id, after)
  }
}

function createBetween(predicate: unknown[]): (value: unknown) => boolean {
  const [lb, ub] = predicate
  return (value: unknown) => {
    return value != null && (value as number) > (lb as number) && (value as number) < (ub as number)
  }
}

function createContains(predicate: Record<string, unknown>): (value: unknown) => boolean {
  return (value: unknown) => {
    if (value && Array.isArray(value)) {
      return value.indexOf(predicate.contains) >= 0
    }
    return false
  }
}

function createEquals(predicate: unknown): (value: unknown) => boolean {
  return (value: unknown) => {
    return value != null && value === predicate
  }
}

function createGreaterOrEqual(predicate: Record<string, unknown>): (value: unknown) => boolean {
  return (value: unknown) => {
    return value != null && (value as number) >= (predicate.gte as number)
  }
}

function createGreaterThan(predicate: Record<string, unknown>): (value: unknown) => boolean {
  return (value: unknown) => {
    return value != null && (value as number) > (predicate.gt as number)
  }
}

function createIn(predicate: Record<string, unknown>): (value: unknown) => boolean {
  return (value: unknown) => {
    if (value != null) {
      if (Array.isArray(value) && typeof value !== 'string') {
        return intersection(value, predicate.in as unknown[]).length > 0
      } else {
        return (predicate.in as unknown[]).indexOf(value) >= 0
      }
    }
    return false
  }
}

function createLessOrEqual(predicate: Record<string, unknown>): (value: unknown) => boolean {
  return (value: unknown) => {
    return value != null && (value as number) <= (predicate.lte as number)
  }
}

function createLessThan(predicate: Record<string, unknown>): (value: unknown) => boolean {
  return (value: unknown) => {
    return value != null && (value as number) < (predicate.lt as number)
  }
}

function createMatch(predicate: Record<string, unknown>): (value: unknown) => boolean {
  const rgx = new RegExp(predicate.match as string, predicate.flags as string | undefined)
  return (value: unknown) => {
    return value != null && rgx.test(value as string)
  }
}

function createNot(predicate: Record<string, unknown>): (value: unknown) => boolean {
  return (value: unknown) => {
    if (value != null) {
      if (Array.isArray(value) && typeof value !== 'string') {
        return intersection(value, predicate.not as unknown[]).length === 0
      } else {
        return (predicate.not as unknown[]).indexOf(value) < 0
      }
    }
    return true
  }
}

function evaluatePredicates(value: unknown, predicates: Array<(v: unknown) => boolean>): boolean {
  return predicates.reduce((acc: boolean, p) => p(value) && acc, true)
}

function find(state: SearchState, type: string, criteria: Record<string, unknown>): unknown[] {
  const fields = Object.keys(criteria)
  let ids: unknown[] | undefined
  let failed = false
  do {
    const field = fields.shift()!
    const predicate = criteria[field]
    const fns: Array<(v: unknown) => boolean> = []
    if (typeof predicate === 'object' && predicate !== null && !Array.isArray(predicate)) {
      const types = Object.keys(predicate as Record<string, unknown>)
      types.forEach(t => {
        switch (t) {
          case 'contains':
            fns.push(createContains(predicate as Record<string, unknown>))
            break
          case 'match':
            fns.push(createMatch(predicate as Record<string, unknown>))
            break
          case 'in':
            fns.push(createIn(predicate as Record<string, unknown>))
            break
          case 'not':
            fns.push(createNot(predicate as Record<string, unknown>))
            break
          case 'gt':
            fns.push(createGreaterThan(predicate as Record<string, unknown>))
            break
          case 'gte':
            fns.push(createGreaterOrEqual(predicate as Record<string, unknown>))
            break
          case 'lt':
            fns.push(createLessThan(predicate as Record<string, unknown>))
            break
          case 'lte':
            fns.push(createLessOrEqual(predicate as Record<string, unknown>))
            break
        }
      })
    } else if (Array.isArray(predicate) && typeof predicate !== 'string') {
      fns.push(createBetween(predicate))
    } else {
      fns.push(createEquals(predicate))
    }
    const values = getIndexedValues(state, type, field, fns)
    const matched = getIndexedIds(state, type, field, values)
    if (!ids) {
      ids = matched
    } else {
      ids = intersection(ids, matched)
    }
    if (ids.length === 0) {
      failed = true
    }
  } while (fields.length > 0 && !failed)
  return ids || []
}

function getFieldIndex(state: SearchState, type: string, field: string): FieldIndex {
  if (!state[type]) {
    state[type] = {}
  }
  if (!state[type][field]) {
    state[type][field] = { values: [], ids: {} }
  }
  return state[type][field]
}

function getIndexedValues(state: SearchState, type: string, field: string, predicates: Array<(v: unknown) => boolean>): unknown[] {
  return getFieldIndex(state, type, field).values
    .reduce((acc: unknown[], v) => {
      if (evaluatePredicates(v, predicates)) {
        acc.push(v)
      }
      return acc
    }, [])
}

function getIndexedIds(state: SearchState, type: string, field: string, values: unknown[]): unknown[] {
  const index = getFieldIndex(state, type, field).ids
  return values.reduce((acc: unknown[], v) => acc.concat(index[v as string]), [])
}

function getFieldValue(obj: Record<string, unknown>, field: string): unknown {
  if (/[.]/.test(field)) {
    return getNestedValue(obj, field.split('.'))
  } else {
    return obj[field]
  }
}

function getNestedValue(obj: unknown, levels: string[]): unknown {
  let level: unknown = obj
  do {
    const f = levels.shift()!
    if (Array.isArray(level)) {
      level = level.map(o => (o as Record<string, unknown>)[f])
    } else {
      level = (level as Record<string, unknown>)[f]
    }
  } while (levels.length > 0 && level)
  return level
}

function update(state: SearchState, type: string, fieldList: string[], updated: Record<string, unknown>, original: Record<string, unknown>): Promise<void> {
  const id = updated.id
  fieldList.forEach(field => {
    const before = getFieldValue(original, field)
    const after = getFieldValue(updated, field)
    addFieldValue(state, type, id, field, before, after)
  })
  return Promise.resolve()
}

export default function (): AdapterLibrary<SearchAdapterInstance> & { state: SearchState; getFieldValue: typeof getFieldValue } {
  const state: SearchState = {}
  return {
    state: state,
    getFieldValue: getFieldValue,
    create: (type: string) => {
      return Promise.resolve({
        find: find.bind(null, state, type),
        update: update.bind(null, state, type)
      })
    }
  }
}
