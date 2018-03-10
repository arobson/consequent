var passenger = require('./passenger')

module.exports = function () {
  return {
    // enable the ability to provide function to produce/fetch initial state
    // split "config" concerns out of actor property
    actor: { // metadata and configuration not persisted
      namespace: 'travel',
      type: 'passenger',
      location: '',
      eventThreshold: 5,
      aggregateFrom: [ 'vehicle' ]
    },
    state: { // initial state for the model
      trips: 0,
      name: '',
      vehicle: null,
      location: ''
    },
    commands: {
      register: passenger.register
    },
    events: {
      registered: passenger.registered,
      boarded: passenger.boarded,
      exited: passenger.exited
    }
  }
}
