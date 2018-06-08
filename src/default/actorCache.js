module.exports = function () {
  return {
    create: () => {
      return Promise.resolve({
        fetch: () => Promise.resolve(undefined),
        getSystemId: () => Promise.resolve(undefined),
        mapIds: () => Promise.resolve(),
        store: () => Promise.resolve()
      })
    }
  }
}
