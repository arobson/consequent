
function boarded (passenger, vehicle) {
  passenger.vehicle = vehicle
}

function exited (passenger, vehicle) {
  passenger.vehicle = null
  passenger.location = vehicle.destination
}

function registered (passenger, name, location) {
  passenger.name = name
  passenger.location = location
}

function register (passenger, name, location) {
  return {
    type: 'passenger.registered',
    name,
    location
  }
}

export default {
  register,

  boarded,
  exited,
  registered
}
