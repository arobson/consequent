declare module 'fount' {
  const fount: {
    inject: (fn: unknown) => Promise<unknown>
    [key: string]: unknown
  }
  export { fount }
  export default fount
}

declare module 'globulesce' {
  function glob(path: string, patterns: string[]): Promise<string[]>
  export default glob
}


declare module 'node-flakes' {
  export function getBase62Provider(nodeIdentifier: string): () => string
  export function getBase36Provider(nodeIdentifier: string): () => string
  export function getBigIntIdProvider(nodeIdentifier: string): () => bigint
  export function getBigIntIdProviderWithNodeId(nodeIdentifier: string): () => bigint
  export function bigIntTo62(value: bigint): string
  export function bigIntTo36(value: bigint): string
}

declare module 'vectorclock' {
  export function increment(vector: Record<string, number>, nodeId: string): void
}

declare module 'pluralize' {
  function pluralize(word: string): string
  export default pluralize
}
