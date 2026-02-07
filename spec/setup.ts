import { expect } from 'vitest'

function deepCompare(a: unknown, b: unknown, k?: string): string[] {
  let diffs: string[] = []
  if (b === undefined || b === null) {
    if (a === b) return diffs
    diffs.push('expected ' + k + ' to equal ' + a + ' but was ' + b + ' ')
  } else if (typeof a === 'object' && a !== null) {
    const entries = Array.isArray(a)
      ? a.map((v, i) => [i, v] as [number, unknown])
      : Object.entries(a as Record<string, unknown>)
    for (const [c, v] of entries) {
      const key = k ? [k, c].join('.') : String(c)
      diffs = diffs.concat(deepCompare(v, (b as Record<string, unknown>)[c as string], key))
    }
  } else {
    const equal = a == b // eslint-disable-line eqeqeq
    if (!equal) {
      diffs.push('expected ' + k + ' to equal ' + a + ' but got ' + b)
    }
  }
  return diffs
}

expect.extend({
  toPartiallyEqual(received: unknown, expected: unknown) {
    const diffs = deepCompare(expected, received)
    return {
      pass: diffs.length === 0,
      message: () => diffs.join('\n\t'),
    }
  },
  toReturnError(received: unknown, message: string) {
    let obj = received
    if (!(obj as Promise<unknown>).then) {
      obj = Promise.resolve(obj)
    }
    return (obj as Promise<unknown>).then((err: unknown) => {
      const isError = err instanceof Error
      const msgMatch = isError && (err as Error).message === message
      return {
        pass: isError && msgMatch,
        message: () =>
          isError
            ? `expected error message to be '${message}' but got '${(err as Error).message}'`
            : `expected an Error instance but got ${typeof err}`,
      }
    })
  }
})

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toPartiallyEqual(expected: unknown): T
    toReturnError(message: string): Promise<T>
  }
  interface AsymmetricMatchersContaining {
    toPartiallyEqual(expected: unknown): unknown
  }
}
