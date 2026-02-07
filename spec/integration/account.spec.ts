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
    })
  })
})
