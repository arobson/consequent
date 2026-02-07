import passenger from './passenger.js'

export default function () {
  return {
    actor: {
      namespace: 'travel',
      type: 'passenger',
      location: '',
      eventThreshold: 5,
      aggregateFrom: [ 'vehicle' ],
      identifiedBy: 'name',
      searchableBy: [ 'name', 'location' ]
    },
    state: {
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
