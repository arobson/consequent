function getAdapter (adapters, lib, type) {
  var adapter = adapters[ type ]
  if (!adapter) {
    adapter = adapters[ type ] = lib.create(type)
  }
  return adapter
}

function find (manager, adapters, lib, type, criteria) {
  return getAdapter(adapters, lib, type)
    .then(
      search => {
        const ids = search.find(criteria)
        if (ids.length) {
          return Promise.all(
            ids.map(id => manager.getOrCreate(type, id))
          )
        } else {
          return Promise.resolve([])
        }
      },
      onAdapterFailure.bind(null, type)
    )
}

function onAdapterFailure(type, err) {
  const error = `Failed to initialize search adapter for type '${type}' with ${err.stack}`
  log.error(error)
  throw new Error(error)
}

function update (adapters, lib, type, fieldList, updated, original) {
  return getAdapter(adapters, lib, type)
    .then(
      search => search.update(fieldList, updated, original),
      onAdapterFailure.bind(null, type)
    )
}

module.exports = function (manager, searchLib) {
  var adapters = {}
  return {
    adapters: adapters,
    find: find.bind(null, manager, adapters, searchLib),
    update: update.bind(null, adapters, searchLib)
  }
}
