module.exports = function () {
  return {
    create: () => {
      return {
        fetch: () => Promise.resolve(undefined),
        getSystemId: () => Promise.resolve(undefined),
        mapIds: () => Promise.resolve(),
        store: () => Promise.resolve()
      }
    }
  }
}
