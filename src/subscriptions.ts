import fd from 'fauxdash'
const { unique } = fd
import type { ActorMap } from './types.js'

interface SubscriptionEntry {
  events: string[]
  commands: string[]
}

function createReverseLookup(actors: Record<string, SubscriptionEntry>): Record<string, string[]> {
  const types = Object.keys(actors)
  return types.reduce((acc: Record<string, string[]>, type) => {
    const topics = actors[type]
    topics.events.forEach((topic) => {
      if (acc[topic]) {
        acc[topic].push(type)
        acc[topic] = unique(acc[topic]).sort()
      } else {
        acc[topic] = [type]
      }
    })
    topics.commands.forEach((topic) => {
      if (acc[topic]) {
        acc[topic].push(type)
        acc[topic] = unique(acc[topic]).sort()
      } else {
        acc[topic] = [type]
      }
    })
    return acc
  }, {})
}

function getSubscriptionMap(actors: ActorMap): Record<string, SubscriptionEntry> {
  const keys = Object.keys(actors)
  return keys.reduce((acc: Record<string, SubscriptionEntry>, key) => {
    const actor = actors[key]
    const metadata = actor.metadata
    function prefix(topic: string) {
      return /[.]/.test(topic) ? topic : `${metadata.actor.type}.${topic}`
    }
    const events = Object.keys(metadata.events || {}).map(prefix)
    const commands = Object.keys(metadata.commands || {}).map(prefix)
    acc[metadata.actor.type] = {
      events: events,
      commands: commands
    }
    return acc
  }, {})
}

function getTopicList(actor: Record<string, SubscriptionEntry>): string[] {
  const keys = Object.keys(actor)
  const lists = keys.reduce((acc: string[], key) => {
    const topics = actor[key]
    acc = acc.concat(topics.events || [])
    acc = acc.concat(topics.commands || [])
    return acc
  }, [])
  return unique(lists).sort()
}

export function getActorLookup(actors: ActorMap): Record<string, string[]> {
  return createReverseLookup(getSubscriptionMap(actors))
}

export function getSubscriptions(actors: ActorMap): Record<string, SubscriptionEntry> {
  return getSubscriptionMap(actors)
}

export function getTopics(actors: ActorMap): string[] {
  return getTopicList(getSubscriptionMap(actors))
}
