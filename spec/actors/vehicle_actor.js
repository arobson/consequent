import vehicle from './vehicle.js'

export default function () {
  return {
    actor: {
      namespace: 'travel',
      type: 'vehicle',
      eventThreshold: 5,
      aggregateFrom: [ 'passenger' ],
      identifiedBy: 'vin',
      searchableBy: [ 'location', 'destination', 'passengers.name' ]
    },
    state: {
      capacity: 0,
      mileage: 0,
      passengers: [],
      status: 'available',
      location: '',
      destination: ''
    },
    commands: {
      provision: vehicle.provision,
      depart: [
        { when: vehicle.isBoarded, then: vehicle.depart },
        () => {}
      ],
      arrive: [
        { when: vehicle.isTraveling, then: vehicle.arrive },
        () => {}
      ],
      board: [
        { when: vehicle.isReserved, then: vehicle.board },
        () => {}
      ],
      exit: [
        { when: vehicle.isArrived, then: vehicle.exit },
        () => {}
      ]
    },
    events: {
      provisioned: vehicle.provisioned,
      reserved: vehicle.reserved,
      departed: vehicle.departed,
      arrived: vehicle.arrived,
      'passenger.boarded': vehicle.boarded,
      'passenger.exited': vehicle.exited
    }
  }
}
