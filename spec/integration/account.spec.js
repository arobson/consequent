require('../setup')

var fn = require('../../src/index')

describe('Consequent Example - Account', () => {
  var consequent
  before(() =>
    fn({
      actors: './spec/actors'
    }).then((x) => {
      consequent = x
    })
  )

  describe('when fetching for missing record', () => {
    it('should result in a blank instance', () =>
      consequent.fetch('account', '0000001')
        .should.eventually.partiallyEql({ state:
        {
          balance: 0,
          holder: '',
          number: '',
          open: false,
          transactions: []
        }
        })
    )
  })

  describe('when handling commands ', () => {
    describe('with a create command', () => {
      var events = []
      var command = {
        type: 'account.open',
        accountHolder: 'Test User',
        accountNumber: '0000001',
        initialDeposit: 100
      }
      before(function () {
        return consequent.handle('0000001', 'account.open', command)
          .then((result) => {
            events = result
          }, console.log)
      })

      it('should produce opened and deposited events', () =>
        events.should.partiallyEql([
          {
            message: command,
            original: {
              id: '0000001',
              balance: 0,
              transactions: []
            },
            state: {
              id: '0000001',
              number: '0000001',
              balance: 100,
              open: true,
              transactions: [
                { credit: 100, debit: 0}
              ]
            },
            events: [
              {
                _actorId: '0000001',
                _actorType: 'account',
                _initiatedBy: 'account.open',
                type: 'account.opened',
                accountHolder: 'Test User',
                accountNumber: '0000001'
              },
              {
                _actorId: '0000001',
                _actorType: 'account',
                _initiatedBy: 'account.open',
                type: 'account.deposited',
                initial: true,
                amount: 100
              }
            ]
          }
        ])
      )

      it('should apply events on next read', () =>
        consequent.fetch('account', '0000001')
          .then((instance) => {
            return instance.state.should.partiallyEql(
              {
                id: '0000001',
                number: '0000001',
                holder: 'Test User',
                balance: 100,
                open: true,
                transactions: [
                  { credit: 100, debit: 0 }
                ]
              }
            )
          })
      )

      describe('when sending commands to existing actor with outstanding events', () => {
        before(() => {
          var withdraw = {
            type: 'account.withdraw',
            amount: 33.33
          }
          return consequent.handle('0000001', 'account.withdraw', withdraw)
        })

        it('should apply events on subsequent read', () =>
          consequent.fetch('account', '0000001')
          .then((instance) => {
            return instance.state.should.partiallyEql(
              {
                id: '0000001',
                number: '0000001',
                holder: 'Test User',
                balance: 66.67,
                open: true,
                transactions: [
                  { credit: 100, debit: 0 },
                  { credit: 0, debit: 33.33 }
                ]
              }
            )
          })
        )
      })
    })
  })
})
