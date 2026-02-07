import { describe, it, expect, beforeAll } from 'vitest'
import * as subscriptions from '../../src/subscriptions.js'
import loader from '../../src/loader.js'
import { fount } from 'fount'

describe('Subscriptions', () => {
  let actors: any
  beforeAll(async () => {
    actors = await loader(fount, './spec/actors')
  })

  describe('when creating subscriptions for actors', () => {
    it('should create subscription map', () => {
      expect(subscriptions.getSubscriptions(actors)).toEqual({
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
        },
        passenger: {
          commands: [
            'passenger.register'
          ],
          events: [
            'passenger.registered',
            'passenger.boarded',
            'passenger.exited'
          ]
        },
        trip: {
          commands: [
            'trip.book'
          ],
          events: [
            'trip.booked',
            'vehicle.departed',
            'vehicle.arrived',
            'vehicle.reserved',
            'passenger.boarded',
            'passenger.exited'
          ]
        },
        vehicle: {
          commands: [
            'vehicle.provision',
            'vehicle.depart',
            'vehicle.arrive',
            'vehicle.board',
            'vehicle.exit'
          ],
          events: [
            'vehicle.provisioned',
            'vehicle.reserved',
            'vehicle.departed',
            'vehicle.arrived',
            'passenger.boarded',
            'passenger.exited'
          ]
        }
      })
    })

    it('should create topic list', () => {
      expect(subscriptions.getTopics(actors)).toEqual(
        ([
          'account.open',
          'account.close',
          'account.opened',
          'account.closed',
          'account.deposit',
          'account.withdraw',
          'account.deposited',
          'account.withdrawn',
          'passenger.register',
          'passenger.registered',
          'passenger.boarded',
          'passenger.exited',
          'trip.book',
          'trip.booked',
          'vehicle.arrive',
          'vehicle.arrived',
          'vehicle.board',
          'vehicle.depart',
          'vehicle.departed',
          'vehicle.exit',
          'vehicle.provision',
          'vehicle.provisioned',
          'vehicle.reserved'
        ]).sort()
      )
    })

    it('should create reverse lookup', () => {
      expect(subscriptions.getActorLookup(actors)).toEqual(
        {
          'account.open': ['account'],
          'account.close': ['account'],
          'account.opened': ['account'],
          'account.closed': ['account'],
          'account.deposit': ['account'],
          'account.withdraw': ['account'],
          'account.deposited': ['account'],
          'account.withdrawn': ['account'],
          'passenger.boarded': ['passenger', 'trip', 'vehicle'],
          'passenger.exited': ['passenger', 'trip', 'vehicle'],
          'passenger.register': ['passenger'],
          'passenger.registered': ['passenger'],
          'trip.book': ['trip'],
          'trip.booked': ['trip'],
          'vehicle.arrive': ['vehicle'],
          'vehicle.arrived': ['trip', 'vehicle'],
          'vehicle.board': ['vehicle'],
          'vehicle.depart': ['vehicle'],
          'vehicle.departed': ['trip', 'vehicle'],
          'vehicle.exit': ['vehicle'],
          'vehicle.provision': ['vehicle'],
          'vehicle.provisioned': ['vehicle'],
          'vehicle.reserved': ['trip', 'vehicle']
        }
      )
    })
  })
})
