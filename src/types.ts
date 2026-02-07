export interface VectorClock {
  [nodeId: string]: number
}

export interface ActorMetadata {
  namespace?: string
  type: string
  eventThreshold?: number
  identifiedBy: string
  searchableBy?: string[]
  aggregateFrom?: string[]
  storeEventPack?: boolean
  snapshotOnRead?: boolean
  _actorTypes: string[]
  _eventTypes: string[]
  _eventsRead?: number
  [key: string]: unknown
}

export interface HandlerDefinition {
  when: boolean | string | ((state: Record<string, unknown>, message?: Record<string, unknown>) => boolean)
  then: ((...args: unknown[]) => unknown)
  exclusive?: boolean
  map?: boolean | ((fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown)
}

export interface ActorInstance {
  actor: ActorMetadata
  state: Record<string, unknown>
  commands: Record<string, HandlerDefinition[]>
  events: Record<string, HandlerDefinition[]>
  [key: string]: unknown
}

export interface ActorRegistration {
  factory: (id?: unknown) => unknown
  metadata: ActorInstance
}

export interface ActorMap {
  [type: string]: ActorRegistration
}

export interface Message {
  type?: string
  topic?: string
  id?: string
  [key: string]: unknown
}

export interface Event extends Message {
  _actorId?: string
  _actorType?: string
  _createdByVector?: string
  _createdByVersion?: number
  _createdBy?: string
  _createdById?: string
  _createdOn?: string
  _initiatedBy?: string
  _initiatedById?: string
}

export interface CommandResult {
  rejected?: boolean
  message: Message
  actor: ActorMetadata
  state: Record<string, unknown>
  original?: Record<string, unknown>
  events?: Event[]
  reason?: Error
}

export interface ActorCacheInstance {
  fetch: (id: unknown) => Promise<Record<string, unknown> | undefined>
  getSystemId?: (id: unknown, asOf?: unknown) => Promise<string | undefined>
  mapIds?: (systemId: string, actorId: unknown) => Promise<void>
  store: (id: unknown, vector: string, state: Record<string, unknown>) => Promise<unknown>
}

export interface ActorStoreInstance {
  fetch: (id: unknown) => Promise<Record<string, unknown> | undefined>
  fetchByLastEventDate?: (id: unknown, lastEventDate: unknown) => Promise<Record<string, unknown> | undefined>
  fetchByLastEventId?: (id: unknown, lastEventId: unknown) => Promise<Record<string, unknown> | undefined>
  getActorId?: (systemId: string, asOf?: unknown) => Promise<string | undefined>
  getSystemId?: (id: unknown, asOf?: unknown) => Promise<string | undefined>
  mapIds?: (systemId: string, actorId: unknown) => Promise<void>
  store: (id: unknown, vector: string, state: Record<string, unknown>) => Promise<unknown>
  findAncestor?: (id: unknown, instances: unknown[], excluded: unknown[]) => Promise<unknown>
}

export interface EventCacheInstance {
  getEventsFor: (id: unknown, lastEventId?: unknown) => Promise<Event[] | undefined>
  getEventPackFor?: (id: unknown, vector: string) => Promise<Event[] | undefined>
  storeEvents: (id: unknown, events: Event[]) => Promise<void>
  storeEventPack?: (id: unknown, vector: string, events: Event[]) => Promise<void>
}

export interface EventStoreInstance {
  getEventsFor: (id: unknown, lastEventId?: unknown) => Promise<Event[] | undefined>
  getEventPackFor?: (id: unknown, vector: string) => Promise<Event[] | undefined>
  getEventStreamFor?: (id: unknown, options: StreamOptions) => Iterable<Event>
  storeEvents: (id: unknown, events: Event[]) => Promise<void>
  storeEventPack?: (id: unknown, vector: string, events: Event[]) => Promise<void>
  findEvents?: (criteria: unknown, lastEventId?: unknown) => Promise<Event[]>
  getEventsByIndex?: (indexName: string, indexValue: unknown, lastEventId?: unknown) => Promise<Event[]>
}

export interface SearchAdapterInstance {
  find: (criteria: Record<string, unknown>) => unknown[]
  update: (fieldList: string[], updated: Record<string, unknown>, original: Record<string, unknown>) => Promise<void>
}

export interface AdapterLibrary<T> {
  create: (type: string) => Promise<T>
  state?: Record<string, unknown>
  [key: string]: unknown
}

export interface StreamOptions {
  since?: unknown
  sinceId?: unknown
  until?: unknown
  untilId?: unknown
  filter?: (event: Event) => boolean
  eventTypes?: string[]
  actorType?: string
  actorId?: unknown
  actorTypes?: string[]
  actors?: Record<string, unknown>
}

export interface ConsequentConfig {
  actors?: string | ActorInstance[] | Record<string, ActorInstance> | (() => unknown)
  actorCache?: AdapterLibrary<ActorCacheInstance>
  actorStore?: AdapterLibrary<ActorStoreInstance>
  eventCache?: AdapterLibrary<EventCacheInstance>
  eventStore?: AdapterLibrary<EventStoreInstance>
  searchAdapter?: AdapterLibrary<SearchAdapterInstance>
  fount?: Fount
  queue?: Queue
  concurrencyLimit?: number
  nodeId?: string
  logging?: LogConfig | { level: string }
}

export interface ConsequentApi {
  apply: (instance: ActorInstance, message: Message) => Promise<unknown>
  fetch: (type: string, id: unknown, readOnly?: boolean) => Promise<ActorInstance | null>
  fetchAll: (options: Record<string, unknown>, readOnly?: boolean) => Promise<Record<string, unknown>>
  find: (type: string, criteria: Record<string, unknown>) => Promise<ActorInstance[]>
  getActorStream: (actorType: string, actorId: unknown, options: StreamOptions) => AsyncGenerator<Record<string, unknown>>
  getEventStream: (actorId: unknown, options: StreamOptions) => Iterable<Event>
  handle: (id: unknown, topic: string, message: Message) => Promise<CommandResult[]>
  topics: string[]
  actors: ActorMap
}

export interface Queue {
  add: (id: string | number, fn: () => unknown) => Promise<unknown>
}

export interface Fount {
  inject: (fn: unknown) => Promise<unknown>
  [key: string]: unknown
}

export type Flakes = () => string

export interface Logger {
  debug: (msg: string) => void
  info: (msg: string) => void
  warn: (msg: string) => void
  error: (msg: string) => void
}

export interface LogConfig {
  level?: string
  stream?: unknown
  adapters?: Record<string, unknown>
}
