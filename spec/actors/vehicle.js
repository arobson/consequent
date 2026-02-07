
function arrive (vehicle, location) {
  return {
    type: 'vehicle.arrived',
    location
  }
}

function board (vehicle, passenger) {
  return {
    type: 'passenger.boarded',
    vehicle,
    passenger
  }
}

function depart () {
  return {
    type: 'vehicle.departed'
  }
}

function exit (vehicle, passenger) {
  return {
    type: 'passenger.exited',
    vehicle,
    passenger
  }
}

function provision (vehicle, location, capacity) {
  return {
    type: 'vehicle.provisioned',
    location,
    capacity
  }
}

function arrived (vehicle, location) {
  vehicle.location = location
  vehicle.status = 'arrived'
}

function boarded (vehicle, passenger) {
  vehicle.passengers.push(passenger)
}

function reserved (vehicle, destination) {
  vehicle.destination = destination
  vehicle.status = 'reserved'
}

function departed (vehicle) {
  vehicle.status = 'departed'
}

function exited (vehicle, passenger) {
  vehicle.passengers = vehicle.passengers.filter(p => p.id === passenger.id)
}

function provisioned (vehicle, location, capacity) {
  vehicle.location = location
  vehicle.capacity = capacity
}

function isArrived (vehicle) {
  return vehicle.status === 'arrived'
}

function isAvailable (vehicle) {
  return vehicle.status === 'arrived' ||
        vehicle.status === 'available'
}

function isBoarded (vehicle) {
  return vehicle.passengers.length === vehicle.trip.reservations
}

function isReserved (vehicle) {
  return vehicle.status === 'reserved'
}

function isTraveling (vehicle) {
  return vehicle.status === 'departed'
}

export default {
  arrive,
  board,
  depart,
  exit,
  provision,

  arrived,
  boarded,
  reserved,
  departed,
  exited,
  provisioned,

  isArrived,
  isAvailable,
  isBoarded,
  isReserved,
  isTraveling
}
