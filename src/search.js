function getAdapter (adapters, lib, type) {
  var adapter = adapters[ type ]
  if (!adapter) {
    adapter = adapters[ type ] = lib.create(type)
  }
  return adapter
}

function find (manager, adapters, lib, type, criteria) {
  const adapter = getAdapter(adapters, lib, type)
  const ids = adapter.find(criteria)
  if (ids.length) {
    return Promise.all(
      ids.map(id => manager.getOrCreate(type, id))
    )
  } else {
    return Promise.resolve([])
  }
}

function update (adapters, lib, type, fieldList, updated, original) {
  const adapter = getAdapter(adapters, lib, type)
  return adapter.update(fieldList, updated, original)
}

module.exports = function (manager, searchLib) {
  var adapters = {}
  return {
    adapters: adapters,
    find: find.bind(null, manager, adapters, searchLib),
    update: update.bind(null, adapters, searchLib)
  }
}
