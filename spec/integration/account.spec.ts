import { describe, it, expect, beforeAll } from 'vitest'
import fn from '../../src/index.js'

describe('Consequent Example - Account', () => {
  let consequent: any
  beforeAll(async () => {
    consequent = await fn({
      actors: './spec/actors'
    })
  })

  describe('when fetching for missing record', () => {
    it('should result in a blank instance', async () => {
      const result = await consequent.fetch('account', '0000001')
      expect(result).toPartiallyEqual({
        state: {
          balance: 0,
          holder: '',
          number: '0000001',
          open: false,
          transactions: []
        }
      })
    })
  })

  describe('when handling commands', () => {
    describe('with a create command', () => {
      let events: any[] = []
      const command = {
        type: 'account.open',
        accountHolder: 'Test User',
        accountNumber: '0000001',
        initialDeposit: 100
      }

      beforeAll(async () => {
        events = await consequent.handle('0000001', 'account.open', command)
      })

      it('should produce opened and deposited events', () => {
        expect(events).toPartiallyEqual([
          {
            message: command,
            original: {
              balance: 0,
              transactions: []
            },
            state: {
              number: '0000001',
              balance: 100,
              open: true,
              transactions: [
                { credit: 100, debit: 0 }
              ]
            },
            events: [
              {
                _actorType: 'account',
                _initiatedBy: 'account.open',
                type: 'account.opened',
                accountHolder: 'Test User',
                accountNumber: '0000001'
              },
              {
                _actorType: 'account',
                _initiatedBy: 'account.open',
                type: 'account.deposited',
                initial: true,
                amount: 100
              }
            ]
          }
        ])
      })

      it('should apply events on next read', async () => {
        const instance = await consequent.fetch('account', '0000001')
        expect(instance.state).toPartiallyEqual({
          number: '0000001',
          holder: 'Test User',
          balance: 100,
          open: true,
          transactions: [
            { credit: 100, debit: 0 }
          ]
        })
      })

      describe('when sending commands to existing actor with outstanding events', () => {
        beforeAll(async () => {
          const withdraw = {
            type: 'account.withdraw',
            amount: 33.33
          }
          await consequent.handle('0000001', 'account.withdraw', withdraw)
        })

        it('should apply events on subsequent read', async () => {
          const instance = await consequent.fetch('account', '0000001')
          expect(instance.state).toPartiallyEqual({
            number: '0000001',
            holder: 'Test User',
            balance: 66.67,
            open: true,
            transactions: [
              { credit: 100, debit: 0 },
              { credit: 0, debit: 33.33 }
            ]
          })
        })
      })

      // Exercises getEventStream/getActorStream against the *real*
      // initialize() wiring (real manager.js, real events.ts, real actors.ts,
      // real default in-memory eventStore) rather than hand-shaped mocks --
      // three real bugs only surfaced against this wiring, none of which
      // streamBuilder.spec.ts's own (equally wrong) mocks could catch:
      //  1. streamBuilder.ts read `manager.models[t].actor`; the real shape
      //     from loader.ts's addActor is `manager.models[t].metadata.actor`.
      //  2. `eventAdapter.fetchStream` (events.ts's own getEventStream) always
      //     returns a Promise; streamBuilder.ts consumed it with a bare,
      //     unawaited `for...of`.
      //  3. `actorAdapter.fetchByLastEventId`/`fetchByLastEventDate` are
      //     `(type, id, lastEventId)` once bound in actors.ts, but
      //     streamBuilder.ts's getActorStream called them with only
      //     `(actorId, lastEventId)` -- silently shifting `actorType` into
      //     the `type` slot as the actor's own id, and dropping the real
      //     lastEventId entirely.
      //
      // Also note (not a bug, a real API contract worth documenting): both
      // functions key events by an actor's *internal* `_id` (the
      // flake-generated system id events.ts stores under), not its public
      // `identifiedBy` business key -- `state._id` from a prior fetch/handle
      // is what a caller must pass, same as this test does below.
      describe('when reading the event stream back', () => {
        it('getEventStream should return all events for the actor in order', async () => {
          const instance = await consequent.fetch('account', '0000001')
          const stream = await consequent.getEventStream(instance.state._id, {
            actorType: 'account',
            sinceId: '0'
          })
          const events = [...stream]
          expect(events.map((e: any) => e.type)).toEqual([
            'account.opened',
            'account.deposited',
            'account.withdrawn'
          ])
        })

        it('getActorStream should replay state transitions from the baseline', async () => {
          const instance = await consequent.fetch('account', '0000001')
          const stream = consequent.getActorStream('account', instance.state._id, { sinceId: '0' })
          const timeline: any[] = []
          for await (const state of stream) {
            timeline.push(state)
          }
          expect(timeline[timeline.length - 1]).toPartiallyEqual({
            number: '0000001',
            holder: 'Test User',
            balance: 66.67,
            open: true
          })
        })
      })
    })
  })
})
