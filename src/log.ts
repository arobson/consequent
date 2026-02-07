import pino from 'pino'
import debug from 'debug'
import type { Logger } from './types.js'

const debugEnv = process.env.DEBUG

let rootLogger = pino({ level: 'silent' })

if (debugEnv) {
  const debugOut = new (await import('stream')).Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      const entry = JSON.parse(chunk.toString())
      debug(entry.name)(entry.msg)
      callback()
    }
  })
  rootLogger = pino({ level: 'debug' }, debugOut)
}

type LogFactory = (name: string) => Logger

export default function logFn(config: string): Logger
export default function logFn(config: Record<string, unknown>): LogFactory
export default function logFn(config: string | Record<string, unknown>): Logger | LogFactory {
  if (typeof config === 'string') {
    return rootLogger.child({ name: config })
  } else {
    const rawLevel = (config.level as string) || 'silent'
    const level = rawLevel === 'none' ? 'silent' : rawLevel
    if (config.stream) {
      rootLogger = pino({ level }, config.stream as pino.DestinationStream)
    } else {
      rootLogger = pino({ level })
    }
    return (name: string) => rootLogger.child({ name })
  }
}
