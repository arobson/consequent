module.exports = function () {
  return {
    create: () => {
      return {
        fetch: () => {
          return Promise.resolve(undefined)
        },
        store: () => {
          return Promise.resolve()
        }
      }
    }
  }
}
