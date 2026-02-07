import vehicleLib from './vehicle.js'

function book (trip, vehicle, passengers, origin, destination) {
  return [
    {
      type: 'trip.booked',
      vehicle,
      passengers,
      origin,
      destination
    },
    {
      type: 'vehicle.reserved',
      vehicle,
      destination
    }
  ]
}

function arrived (trip) {
  trip.status = 'complete'
}

function booked (trip, vehicle, passengers, origin, destination) {
  trip.vehicle = vehicle
  trip.passengers = passengers
  trip.origin = origin
  trip.destination = destination
  trip.status = 'booked'
}

function boarded (trip, passenger) {
  vehicleLib.boarded(trip.vehicle, passenger)
}

function departed (trip) {
  trip.status = 'begun'
}

function exited (trip, passenger) {
  trip.passengers = trip.passengers.filter(p => p.id === passenger.id)
  vehicleLib.exited(trip.vehicle, passenger)
}

function reserved (trip, destination) {
  vehicleLib.reserved(trip.vehicle, destination)
}

export default {
  book,

  booked,
  arrived,
  boarded,
  departed,
  reserved,
  exited
}
