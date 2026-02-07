import { describe, it, expect, beforeAll } from 'vitest'
import loader from '../../src/loader.js'
import { fount } from 'fount'
import path from 'node:path'
import fd from 'fauxdash'
const { mapCall } = fd

describe('Loading Actors', () => {
  describe('with bad path', () => {
    it('should result in an error', () =>
      expect(loader(fount, './noSuch'))
        .rejects.toThrow(
          `Could not load actors from non-existent path '${path.resolve('./')}/noSuch'`
        )
    )
  })

  describe('with valid path', function () {
    let actors: any
    beforeAll(async function () {
      actors = await loader(fount, './spec/actors')
    })

    it('should resolve with actors', function () {
      expect(actors).toHaveProperty('account')
    })

    it('should return valid factory', function () {
      expect(actors.account.metadata).toHaveProperty('actor')
      expect(actors.account.metadata).toHaveProperty('commands')
      expect(actors.account.metadata).toHaveProperty('events')
    })

    it('should populate metadata on load', function () {
      expect(actors.account.metadata.actor._actorTypes).toEqual(['account'])
      expect(actors.account.metadata.actor._eventTypes).toEqual([
        'account.opened',
        'account.closed',
        'account.deposited',
        'account.withdrawn'
      ])
      expect(actors.trip.metadata.actor._actorTypes).toEqual(['trip', 'vehicle', 'passenger'])
      expect(actors.trip.metadata.actor._eventTypes).toEqual([
        'trip.booked',
        'vehicle.departed',
        'vehicle.arrived',
        'vehicle.reserved',
        'passenger.boarded',
        'passenger.exited'
      ])
      expect(actors.trip.metadata.actor.aggregateFrom).toEqual(['vehicle', 'passenger'])
    })
  })

  describe('with array of actor instances', () => {
    let actors: any
    const instance = {
      actor: { type: 'widget', identifiedBy: 'id', _actorTypes: [], _eventTypes: [] },
      state: { id: null },
      commands: { doThing: (state: any) => state },
      events: { thingDone: (state: any) => state }
    }

    beforeAll(async () => {
      actors = await loader(fount, [instance] as any)
    })

    it('should return ActorMap from array', () => {
      expect(actors).toHaveProperty('widget')
      expect(actors.widget.metadata.actor.type).toBe('widget')
    })
  })

  describe('with object map of instances', () => {
    let actors: any
    const instance = {
      actor: { type: 'gadget', identifiedBy: 'id', _actorTypes: [], _eventTypes: [] },
      state: { id: null },
      commands: { doStuff: (state: any) => state },
      events: { stuffDone: (state: any) => state }
    }

    beforeAll(async () => {
      actors = await loader(fount, { gadget: instance } as any)
    })

    it('should return ActorMap from object', () => {
      expect(actors).toHaveProperty('gadget')
      expect(actors.gadget.metadata.actor.type).toBe('gadget')
    })
  })

  describe('with unrecognized input type', () => {
    it('should return empty ActorMap', async () => {
      const actors = await loader(fount, 12345 as any)
      expect(actors).toEqual({})
    })
  })

  describe('processHandle with raw value (not function/array/object)', () => {
    let actors: any
    const instance = {
      actor: { type: 'raw', identifiedBy: 'id', _actorTypes: [], _eventTypes: [] },
      state: { id: null },
      commands: { doRaw: 'raw-value' },
      events: {}
    }

    beforeAll(async () => {
      actors = await loader(fount, [instance] as any)
    })

    it('should treat as simple exclusive handler', () => {
      expect(actors).toHaveProperty('raw')
      const handlers = actors.raw.metadata.commands['raw.doRaw']
      expect(handlers).toBeDefined()
      expect(handlers[0].exclusive).toBe(true)
      expect(handlers[0].when).toBe(true)
    })
  })
})
