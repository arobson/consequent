import { describe, it, expect, beforeAll } from 'vitest'
import fn from '../../src/index.js'

describe('Consequent Example - Trip', function () {
  let consequent: any
  beforeAll(async () => {
    consequent = await fn({
      actors: './spec/actors'
    })
  })

  describe('when fetching for missing records', function () {
    it('should result in a blank trip', async () => {
      const result = await consequent.fetch('trip', '0000001')
      expect(result).toPartiallyEqual({
        state: {
          id: '0000001',
          passengers: [],
          vehicle: null,
          status: 'pending',
          origin: '',
          destination: ''
        }
      })
    })

    it('should result in a blank vehicle', async () => {
      const result = await consequent.fetch('vehicle', 'ABCD0001')
      expect(result).toPartiallyEqual({
        state: {
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

    it('should result in a blank passenger', async () => {
      const result = await consequent.fetch('passenger', 'Test Passenger 1')
      expect(result).toPartiallyEqual({
        state: {
          name: 'Test Passenger 1',
          trips: 0,
          vehicle: null
        }
      })
    })
  })

  describe('when handling commands', function () {
    describe('with a passenger registration command', function () {
      let events: any[] = []
      const command = {
        type: 'passenger.register',
        name: 'Test Passenger 1',
        location: '31001'
      }

      beforeAll(async () => {
        events = await consequent.handle('Test Passenger 1', 'passenger.register', command)
      })

      it('should produce registered event', function () {
        expect(events).toPartiallyEqual([
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

      it('should apply events on next read', async () => {
        const instance = await consequent.fetch('passenger', 'Test Passenger 1')
        expect(instance.state).toPartiallyEqual({
          trips: 0,
          name: 'Test Passenger 1',
          location: '31001',
          vehicle: null
        })
      })
    })

    describe('with a vehicle provisioning command', function () {
      let events: any[] = []
      const command = {
        type: 'vehicle.provision',
        location: '31001',
        capacity: 4
      }

      beforeAll(async () => {
        events = await consequent.handle('ABCD0001', 'vehicle.provision', command)
      })

      it('should produce provisioned event', function () {
        expect(events).toPartiallyEqual([
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

      it('should apply events on next read', async () => {
        const instance = await consequent.fetch('vehicle', 'ABCD0001')
        expect(instance.state).toPartiallyEqual({
          capacity: 4,
          mileage: 0,
          passengers: [],
          status: 'available',
          location: '31001',
          destination: ''
        })
      })
    })

    describe('with a trip booking command', function () {
      let result: any
      const command: any = {
        type: 'trip.book',
        destination: '12401',
        origin: '31001'
      }

      beforeAll(async () => {
        const records = await consequent.fetchAll({
          vehicle: 'ABCD0001',
          passenger: 'Test Passenger 1'
        })
        command.vehicle = records.vehicle.state
        command.passengers = [records.passenger.state]
        const results = await consequent.handle('0000001', 'trip.book', command)
        result = results[0]
      })

      it('should produce booked and reserved events', function () {
        expect(result).toPartiallyEqual({
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

      it('should apply events on next read of trip', async () => {
        const instance = await consequent.fetch('trip', '0000001')
        expect(instance.state).toPartiallyEqual({
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
        })
      })

      it('should apply events on next read of vehicle', async () => {
        const instance = await consequent.fetch('vehicle', 'ABCD0001')
        expect(instance.state).toPartiallyEqual({
          capacity: 4,
          mileage: 0,
          passengers: [],
          status: 'reserved',
          location: '31001',
          destination: '12401'
        })
      })

      describe('when sending commands to existing actor with outstanding events', function () {
        beforeAll(async () => {
          const records = await consequent.fetchAll({
            vehicle: 'ABCD0001',
            passenger: 'Test Passenger 1'
          })
          const board = {
            type: 'vehicle.board',
            vehicle: records.vehicle.state,
            passenger: records.passenger.state
          }
          await consequent.handle('ABCD0001', 'vehicle.board', board)
        })

        it('should apply events on subsequent read', async () => {
          const instance = await consequent.fetch('trip', '0000001')
          expect(instance.state).toPartiallyEqual({
            vehicle: {
              capacity: 4,
              mileage: 0,
              passengers: [{
                name: 'Test Passenger 1',
                location: '31001'
              }],
              status: 'reserved',
              location: '31001',
              destination: '12401'
            },
            origin: '31001',
            destination: '12401',
            passengers: [{
              name: 'Test Passenger 1',
              location: '31001'
            }],
            status: 'booked'
          })
        })

        it('should find match based on up-to-date search fields', async () => {
          const results = await consequent.find('trip', {
            'vehicle.location': '31001',
            'passengers.name': { match: 'Test' }
          })
          expect(results).toPartiallyEqual([
            {
              state: {
                vehicle: {
                  capacity: 4,
                  mileage: 0,
                  passengers: [{
                    name: 'Test Passenger 1',
                    location: '31001'
                  }],
                  status: 'reserved',
                  location: '31001',
                  destination: '12401'
                },
                origin: '31001',
                destination: '12401',
                passengers: [{
                  name: 'Test Passenger 1',
                  location: '31001'
                }],
                status: 'booked'
              }
            }
          ])
        })

        it('should report no match based on up-to-date search fields', async () => {
          const results = await consequent.find('trip', {
            'vehicle.location': '31001',
            'passengers.location': '31002'
          })
          expect(results).toEqual([])
        })
      })
    })
  })
})
