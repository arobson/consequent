require('../setup')
const subscriptions = require('../../src/subscriptions')
const loader = require('../../src/loader')
const fount = require('fount')

describe('Subscriptions', () => {
  var actors
  before(() => {
    return loader(fount, './spec/actors')
      .then((result) => {
        actors = result
      })
  })

  describe('when creating subscriptions for actors', () => {
    it('should create subscription map', () => {
      subscriptions.getSubscriptions(actors).should.eql({
        account: {
          commands: [
            'account.open',
            'account.close',
            'account.deposit',
            'account.withdraw'
          ],
          events: [
            'account.opened',
            'account.closed',
            'account.deposited',
            'account.withdrawn'
          ]
        }
      })
    })

    it('should create topic list', () => {
      subscriptions.getTopics(actors).should.eql(
        ([
          'account.open',
          'account.close',
          'account.opened',
          'account.closed',
          'account.deposit',
          'account.withdraw',
          'account.deposited',
          'account.withdrawn'
        ]).sort()
      )
    })

    it('should create reverse lookup', () => {
      subscriptions.getActorLookup(actors).should.eql(
        {
          'account.open': [ 'account' ],
          'account.close': [ 'account' ],
          'account.opened': [ 'account' ],
          'account.closed': [ 'account' ],
          'account.deposit': [ 'account' ],
          'account.withdraw': [ 'account' ],
          'account.deposited': [ 'account' ],
          'account.withdrawn': [ 'account' ]
        }
      )
    })
  })
})
