var vehicle = require('./vehicle')

module.exports = function () {
  return {
    // enable the ability to provide function to produce/fetch initial state
    // split "config" concerns out of actor property
    actor: { // metadata and configuration not persisted
      namespace: 'travel',
      type: 'vehicle',
      eventThreshold: 5,
      aggregateFrom: [ 'passenger' ],
      identifiedBy: 'vin',
      searchableBy: [ 'location', 'destination', 'passengers.name' ]
    },
    state: { // initial state for the model
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
        _.noop
      ],
      arrive: [
        { when: vehicle.isTraveling, then: vehicle.arrive },
        _.noop
      ],
      board: [
        { when: vehicle.isReserved, then: vehicle.board },
        _.noop
      ],
      exit: [
        { when: vehicle.isArrived, then: vehicle.exit },
        _.noop
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
