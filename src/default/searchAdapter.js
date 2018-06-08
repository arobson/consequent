const { contains, map, reduce, intersection, without } = require('fauxdash')


function addToFieldIndex (fieldIndex, id, value) {
  if (value) {
    if (!fieldIndex.ids[value]) {
      fieldIndex.ids[value] = []
    }
    fieldIndex.ids[value].push(id)
    if (fieldIndex.values.indexOf(value) < 0) {
      fieldIndex.values.push(value)
      fieldIndex.values.sort()
    }
  }
}

function removeFromFieldIndex (fieldIndex, id, value) {
  const ids = fieldIndex.ids[value]
  if (ids && ids.length === 1) {
    let index = fieldIndex.values.indexOf(value)
    fieldIndex.values.splice(index, 1)
    fieldIndex.ids[value] = []
  } else if (fieldIndex.ids[value] && fieldIndex.ids[value].length > 0) {
    let index = fieldIndex.ids[value].indexOf(id)
    fieldIndex.ids[value].splice(index,1)
  }
}

function addFieldValue (state, type, id, field, before, after) {
  if (Array.isArray(before) && Array.isArray(after)) {
    const fieldIndex = getFieldIndex(state, type, field)
    const additions = without(after, before)
    const removals = without(before, after)
    additions.forEach(add => addToFieldIndex(fieldIndex, id, add))
    removals.forEach(remove => removeFromFieldIndex(fieldIndex, id, remove))
  } else {
    const fieldIndex = getFieldIndex(state, type, field)
    removeFromFieldIndex(fieldIndex, id, before)
    addToFieldIndex(fieldIndex, id, after)
  }
}

function createBetween (predicate, field) {
  const [lb, ub] = predicate
  return (value) => {
    return value && value > lb && value < ub
  }
}

function createContains (predicate, field) {
  return (value) => {
    if (value && Array.isArray(value)) {
      return value.indexOf(predicate.contains) >= 0
    }
    return false
  }
}

function createEquals (predicate, field) {
  return (value) => {
    return value && value === predicate
  }
}

function createGreaterOrEqual (predicate, field) {
  return (value) => {
    return value && value >= predicate.gte
  }
}

function createGreaterThan (predicate, field) {
  return (value) => {
    return value && value > predicate.gt
  }
}

function createIn (predicate, field) {
  return (value) => {
    if (value) {
      if (Array.isArray(value) && typeof value !== 'string') {
        return intersection(value, predication.in).length > 0
      } else {
        return contains(predicate.in, value)
      }
    }
    return false
  }
}

function createLessOrEqual (predicate, field) {
  return (value) => {
    return value && value <= predicate.lte
  }
}

function createLessThan (predicate, field) {
  return (value) => {
    return value && value < predicate.lt
  }
}

function createMatch (predicate, field) {
  const rgx = new RegExp(predicate.match, predicate.flags)
  return (value) => {
    return value && rgx.test(value)
  }
}

function createNot (predicate, field) {
  return (value) => {
    if (value) {
      if (Array.isArray(value) && typeof value !== 'string') {
        return intersection(value, predication.not).length === 0
      } else {
        return !contains(predicate.not, value)
      }
    }
    return true
  }
}

function evaluatePredicates (value, predicates) {
  return predicates.reduce((acc, p) => p(value) && acc, true)
}

function find (state, type, criteria) {
  let fields = Object.keys(criteria)
  let ids
  let failed = false
  do {
    let field = fields.shift()
    let predicate = criteria[field]
    let fns = []
    if (typeof predicate === 'object') {
      let types = Object.keys(predicate)
      types.forEach(type => {
        switch(type) {
          case 'contains':
            fns.push(createContains(predicate, field))
            break;
          case 'match':
            fns.push(createMatch(predicate, field))
            break;
          case 'in':
            fns.push(createIn(predicate, field))
            break;
          case 'not':
            fns.push(createNot(predicate, field))
            break;
          case 'gt':
            fns.push(createGreaterThan(predicate, field))
            break;
          case 'gte':
            fns.push(createGreaterOrEqual(predicate, field))
            break;
          case 'lt':
            fns.push(createLessThan(predicate, field))
            break;
          case 'lte':
            fns.push(createLessOrEqual(predicate, field))
            break;
        }
      })
    } else if (Array.isArray(predicate) && typeof predicate !== 'string') {
      fns.push(createBetween(predicate, field))
    } else {
      fns.push(createEquals(predicate, field))
    }
    let values = getIndexedValues(state, type, field, fns)
    let matched = getIndexedIds(state, type, field, values)
    if (!ids) {
      ids = matched
    } else {
      ids = intersection(ids, matched)
    }
    if (ids.length === 0) {
      failed = true
    }
  } while (fields.length > 0 && !failed)
  return ids
}

function getTypeIndex (state, type) {
  if (!state[type]) {
    state[type] = { fields: {} }
  }
  return state[type]
}

function getFieldIndex (state, type, field) {
  const typeIndex = getTypeIndex(state, type)
  if (!typeIndex[field]) {
    typeIndex[field] = { values: [], ids: {}}
  }
  return typeIndex[field]
}

function getIndexedValues (state, type, field, predicates) {
  return getFieldIndex(state, type, field).values
    .reduce((acc, v) => {
      if (evaluatePredicates(v, predicates)) {
        acc.push(v)
      }
      return acc
    }, [])
}

function getIndexedIds (state, type, field, values) {
  const index = getFieldIndex(state, type, field).ids
  return values.reduce((acc, v) => acc.concat(index[v]), [])
}

function getFieldValue (obj, field) {
  if(/[.]/.test(field)) {
    return getNestedValue(obj, field.split('.'))
  } else {
    return obj[field]
  }
}

function getNestedValue (obj, levels) {
  var f
  var level = obj
  do {
    f = levels.shift()
    if (Array.isArray(level)) {
      level = level.map(o => o[f])
    } else {
      level = level[f]
    }
  } while (levels.length > 0 && level)
  return level
}

function update (state, type, fieldList, updated, original) {
  let id = updated.id
  fieldList.forEach(field => {
    let before = getFieldValue(original, field)
    let after = getFieldValue(updated, field)
    addFieldValue(state, type, id, field, before, after)
  })
  return Promise.resolve()
}

module.exports = () => {
  const state = {}
  return {
    state: state,
    getFieldValue: getFieldValue,
    create: (type) => {
      return Promise.resolve({
        find: find.bind(null, state, type),
        update: update.bind(null, state, type)
      })
    }
  }
}
