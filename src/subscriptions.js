const { unique } = require('fauxdash')

function createReverseLookup (actors) {
  let types = Object.keys(actors)
  return types.reduce((acc, type) => {
    let topics = actors[ type ]
    topics.events.forEach((topic) => {
      if (acc[ topic ]) {
        acc[ topic ].push(type)
        acc[ topic ] = unique(acc[ topic ]).sort()
      } else {
        acc[ topic ] = [ type ]
      }
    })
    topics.commands.forEach((topic) => {
      if (acc[ topic ]) {
        acc[ topic ].push(type)
        acc[ topic ] = unique(acc[ topic ]).sort()
      } else {
        acc[ topic ] = [ type ]
      }
    })
    return acc
  }, {})
}

function getSubscriptionMap (actors) {
  let keys = Object.keys(actors)
  return keys.reduce((acc, key) => {
    let actor = actors[ key ]
    let metadata = actor.metadata
    function prefix (topic) {
      return /[.]/.test(topic) ? topic : `${metadata.actor.type}.${topic}`
    }
    let events = Object.keys(metadata.events || {}).map(prefix)
    let commands = Object.keys(metadata.commands || {}).map(prefix)
    acc[ metadata.actor.type ] = {
      events: events,
      commands: commands
    }
    return acc
  }, {})
}

function getTopicList (actor) {
  let keys = Object.keys(actor)
  let lists = keys.reduce((acc, key) => {
    let topics = actor[ key ]
    acc = acc.concat(topics.events || [])
    acc = acc.concat(topics.commands || [])
    return acc
  }, [])
  return unique(lists).sort()
}

module.exports = {
  getActorLookup: function (actors) {
    return createReverseLookup(getSubscriptionMap(actors))
  },
  getSubscriptions: getSubscriptionMap,
  getTopics: function (actors) {
    return getTopicList(getSubscriptionMap(actors))
  }
}
