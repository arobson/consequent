require('../setup')
const loader = require('../../src/loader')
const fount = require('fount')
const path = require('path')

describe('Loading Actors', () => {
  describe('with bad path', () => {
    it('should result in an error', () =>
      loader(fount, './noSuch')
        .should.eventually.be
        .rejectedWith(
          `Could not load actors from non-existent path '${path.resolve('./')}/noSuch'`
        )
    )
  })

  describe('with valid path', function () {
    var actors
    before(function () {
      return loader(fount, './spec/actors')
        .then((res) => {
          actors = res
        })
    })

    it('should resolve with actors', function () {
      actors.should.have.property('account')
    })

    it('should return valid factory', function () {
      actors.account.metadata.should.include.keys([ 'actor', 'commands', 'events' ])
    })

    it('should populate metadata on load', function () {
      actors.account.metadata.actor._actorTypes.should.eql(['account'])
      actors.account.metadata.actor._eventTypes.should.eql([
        'account.opened',
        'account.closed',
        'account.deposited',
        'account.withdrawn'
      ])
      actors.trip.metadata.actor._actorTypes.should.eql(['trip', 'vehicle', 'passenger'])
      actors.trip.metadata.actor._eventTypes.should.eql([
        'trip.booked',
        'vehicle.departed',
        'vehicle.arrived',
        'vehicle.reserved',
        'passenger.boarded',
        'passenger.exited'
      ])
      actors.trip.metadata.actor.aggregateFrom.should.eql(['vehicle', 'passenger'])
    })
  })
})
