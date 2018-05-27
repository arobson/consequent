var trip = require('./trip')

module.exports = function () {
  return {
    // enable the ability to provide function to produce/fetch initial state
    // split "config" concerns out of actor property
    actor: { // metadata and configuration not persisted
      namespace: 'travel',
      type: 'trip',
      searchableBy: [
        'vehicle.location',
        'vehicle.destination',
        'passengers.location',
        'passengers.name',
      ],
      eventThreshold: 10,
      identifiedBy: 'id'
    },
    state: { // initial state for the model
      passengers: [],
      vehicle: null,
      status: 'pending',
      origin: '',
      destination: ''
    },
    commands: {
      book: trip.book
    },
    events: {
      booked: trip.booked,
      'vehicle.departed': trip.departed,
      'vehicle.arrived': trip.arrived,
      'vehicle.reserved': trip.reserved,
      'passenger.boarded': trip.boarded,
      'passenger.exited': trip.exited
    }
  }
}
