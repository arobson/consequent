interface Namespace {
  entries: {
    info: string[]
    debug: string[]
    warn: string[]
    error: string[]
  }
}

const pinoLevels: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal'
}

const namespaces: Record<string, Namespace> = {}

const adapter = {
  namespaces: namespaces,
  init(ns: string): Namespace {
    if (!namespaces[ns]) {
      namespaces[ns] = { entries: { info: [], debug: [], warn: [], error: [] } }
    }
    namespaces[ns].entries = {
      info: [],
      debug: [],
      warn: [],
      error: []
    }
    return namespaces[ns]
  },
  reset(ns: string): void {
    this.init(ns)
  },
  write(raw: Buffer | string): void {
    const entry = JSON.parse(raw.toString())
    const levelName = pinoLevels[entry.level] || 'info'
    const name = entry.name
    let ns = namespaces[name]
    if (!ns) {
      ns = this.init(name)
    }
    if (levelName in ns.entries) {
      ns.entries[levelName as keyof Namespace['entries']].push(entry.msg)
    }
  }
}

export default function mockLogAdapter(ns: string) {
  adapter.init(ns)
  return adapter
}
