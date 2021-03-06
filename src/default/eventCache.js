module.exports = function () {
  return {
    create: () => {
      return Promise.resolve({
        getEventsFor: () => {
          return Promise.resolve([])
        },
        getEventPackFor: () => {
          return Promise.resolve(undefined)
        },
        storeEvents: () => {
          return Promise.resolve()
        },
        storeEventPackFor: () => {
          return Promise.resolve()
        }
      })
    }
  }
}
