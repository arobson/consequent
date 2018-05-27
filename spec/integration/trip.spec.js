require('../setup')

var fn = require('../../src/index')

describe('Consequent Example - Trip', function () {
  var consequent
  before(function () {
    fn({
      actors: './spec/actors'
    }).then((x) => {
      consequent = x
    })
  })

  describe('when fetching for missing records', function () {
    it('should result in a blank trip', function () {
      return consequent.fetch('trip', '0000001')
        .should.eventually.partiallyEql({ state:
        {
          id: '0000001',
          passengers: [],
          vehicle: null,
          status: 'pending',
          origin: '',
          destination: ''
        }
        })
    })

    it('should result in a blank vehicle', function () {
      return consequent.fetch('vehicle', 'ABCD0001')
        .should.eventually.partiallyEql({ state:
        {
          vin: 'ABCD0001',
          capacity: 0,
          mileage: 0,
          passengers: [],
          status: 'available',
          location: '',
          destination: ''
        }
        })
    })

    it('should result in a blank passenger', function () {
      return consequent.fetch('passenger', 'Test Passenger 1')
        .should.eventually.partiallyEql({ state:
        {
          name: 'Test Passenger 1',
          trips: 0,
          vehicle: null
        }
        })
    })
  })

  describe('when handling commands ', function () {
    describe('with a passenger registration command', function () {
      var events = []
      var command = {
        type: 'passenger.register',
        name: 'Test Passenger 1',
        location: '31001'
      }
      before(function () {
        return consequent.handle('Test Passenger 1', 'passenger.register', command)
          .then((result) => {
            events = result
          }, console.log)
      })

      it('should produce registered event', function () {
        return events.should.partiallyEql([
          {
            message: command,
            original: {
              trips: 0,
              name: 'Test Passenger 1',
              location: '',
              vehicle: null
            },
            state: {
              trips: 0,
              name: 'Test Passenger 1',
              location: '31001',
              vehicle: null
            },
            events: [
              {
                _actorType: 'passenger',
                _initiatedBy: 'passenger.register',
                type: 'passenger.registered',
                location: '31001',
                name: 'Test Passenger 1'
              }
            ]
          }
        ])
      })

      it('should apply events on next read', function () {
        return consequent.fetch('passenger', 'Test Passenger 1')
          .then((instance) => {
            return instance.state.should.partiallyEql(
              {
                trips: 0,
                name: 'Test Passenger 1',
                location: '31001',
                vehicle: null
              }
            )
          })
      })
    })

    describe('with a vehicle provisioning command', function () {
      var events = []
      var command = {
        type: 'vehicle.provision',
        location: '31001',
        capacity: 4
      }
      before(function () {
        return consequent.handle('ABCD0001', 'vehicle.provision', command)
          .then((result) => {
            events = result
          }, console.log)
      })

      it('should produce provisioned event', function () {
        return events.should.partiallyEql([
          {
            message: command,
            original: {
              capacity: 0,
              mileage: 0,
              passengers: [],
              status: 'available',
              location: '',
              destination: ''
            },
            state: {
              vin: 'ABCD0001',
              capacity: 4,
              mileage: 0,
              passengers: [],
              status: 'available',
              location: '31001',
              destination: ''
            },
            events: [
              {
                _actorType: 'vehicle',
                _initiatedBy: 'vehicle.provision',
                type: 'vehicle.provisioned',
                location: '31001',
                capacity: 4
              }
            ]
          }
        ])
      })

      it('should apply events on next read', function () {
        consequent.fetch('vehicle', 'ABCD0001')
          .then((instance) => {
            return instance.state.should.partiallyEql(
              {
                capacity: 4,
                mileage: 0,
                passengers: [],
                status: 'available',
                location: '31001',
                destination: ''
              }
            )
          })
      })
    })

    describe('with a trip booking command', function () {
      var result
      var command = {
        type: 'trip.book',
        destination: '12401',
        origin: '31001'
      }
      before(function () {
        return consequent.fetchAll({
          vehicle: 'ABCD0001',
          passenger: 'Test Passenger 1'
        })
        .then(
          records => {
            command.vehicle = records.vehicle.state
            command.passengers = [ records.passenger.state ]
            return consequent.handle('0000001', 'trip.book', command)
              .then(
                x => {
                  result = x[ 0 ]
                },
                console.log
              )
          }
        )
      })

      it('should produce booked and reserved events', function () {
        return result.should.partiallyEql({
          message: command,
          original: {
            vehicle: null,
            passengers: [],
            origin: '',
            destination: '',
            status: 'pending'
          },
          state: {
            vehicle: {
              capacity: 4,
              mileage: 0,
              passengers: [],
              status: 'reserved',
              location: '31001',
              destination: '12401'
            },
            passengers: [{
              name: 'Test Passenger 1',
              location: '31001'
            }],
            origin: '31001',
            destination: '12401',
            status: 'booked'
          },
          events: [
            {
              _actorType: 'trip',
              _initiatedBy: 'trip.book',
              type: 'trip.booked',
              vehicle: {
                capacity: 4,
                mileage: 0,
                passengers: [],
                status: 'reserved',
                location: '31001',
                destination: '12401'
              },
              passengers: [{
                name: 'Test Passenger 1',
                location: '31001'
              }],
              origin: '31001',
              destination: '12401'
            },
            {
              _actorType: 'vehicle',
              _initiatedBy: 'trip.book',
              type: 'vehicle.reserved',
              destination: '12401'
            }
          ]
        })
      })

      it('should apply events on next read of trip', function () {
        return consequent.fetch('trip', '0000001')
          .then((instance) => {
            return instance.state.should.partiallyEql(
              {
                vehicle: {
                  capacity: 4,
                  mileage: 0,
                  passengers: [],
                  status: 'reserved',
                  location: '31001',
                  destination: '12401'
                },
                passengers: [{
                  name: 'Test Passenger 1',
                  location: '31001'
                }],
                origin: '31001',
                destination: '12401',
                status: 'booked'
              }
            )
          })
      })

      it('should apply events on next read of vehicle', function () {
        return consequent.fetch('vehicle', 'ABCD0001')
          .then((instance) => {
            return instance.state.should.partiallyEql(
              {
                capacity: 4,
                mileage: 0,
                passengers: [],
                status: 'reserved',
                location: '31001',
                destination: '12401'
              }
            )
          })
      })

      describe('when sending commands to existing actor with outstanding events', function () {
        before(function () {
          return consequent.fetchAll({
            vehicle: 'ABCD0001',
            passenger: 'Test Passenger 1'
          }).then(
            records => {
              var board = {
                type: 'vehicle.board',
                vehicle: records.vehicle.state,
                passenger: records.passenger.state
              }
              return consequent.handle('ABCD0001', 'vehicle.board', board)
            }
          )
        })

        it('should apply events on subsequent read', function () {
          return consequent.fetch('trip', '0000001')
            .then((instance) => {
              return instance.state.should.partiallyEql(
                {
                  vehicle: {
                    capacity: 4,
                    mileage: 0,
                    passengers: [ {
                      name: 'Test Passenger 1',
                      location: '31001'
                    } ],
                    status: 'reserved',
                    location: '31001',
                    destination: '12401'
                  },
                  origin: '31001',
                  destination: '12401',
                  passengers: [ {
                    name: 'Test Passenger 1',
                    location: '31001'
                  } ],
                  status: 'booked'
                }
              )
            })
        })

        it('should find match based on up-to-date search fields', function () {
          return consequent.find('trip', {
            'vehicle.location': '31001',
            'passengers.name': { match: 'Test' }
          }).then(results => {
            return results.should.partiallyEql([
              {
                state: {
                  vehicle: {
                    capacity: 4,
                    mileage: 0,
                    passengers: [ {
                      name: 'Test Passenger 1',
                      location: '31001'
                    } ],
                    status: 'reserved',
                    location: '31001',
                    destination: '12401'
                  },
                  origin: '31001',
                  destination: '12401',
                  passengers: [ {
                    name: 'Test Passenger 1',
                    location: '31001'
                  } ],
                  status: 'booked'
                }
              }
            ])
          })
        })

        it('should report no match based on up-to-date search fields', function () {
          return consequent.find('trip', {
            'vehicle.location': '31001',
            'passengers.location': '31002'
          }).then(results => {
            return results.should.eql([])
          })
        })
      })
    })
  })
})
