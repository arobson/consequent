import trip from './trip.js'

export default function () {
  return {
    actor: {
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
    state: {
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
