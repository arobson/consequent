require('../setup')
const apply = require('../../src/apply')
const loader = require('../../src/loader')
const fount = require('fount')
const hashqueue = require('haberdasher').queue
const queue = hashqueue.create(4)

function yep () {
  return true
}
function nope () {
  return false
}

function createMetadata () {
  return {
    test: {
      actor: {
        type: 'test'
      },
      state: {
        id: 1
      },
      commands: {
        doOne: [
          {
            when: nope,
            then: function (actor, command) {
              return [
                { type: 'one.zero', id: 1 }
              ]
            }
          },
          {
            when: yep,
            then: function (actor, command) {
              return [
                { type: 'one.one', id: 1 }
              ]
            }
          },
          {
            when: yep,
            then: function (actor, command) {
              return [
                { type: 'one.two', id: 2 }
              ]
            }
          }
        ],
        doTwo: [
          {
            when: yep,
            then: function (actor, command) {
              return [
                { type: 'two.one', id: 3 }
              ]
            },
            exclusive: false
          },
          {
            then: function (actor, command) {
              return [
                { type: 'two.two', id: 4 }
              ]
            },
            exclusive: false
          }
        ],
        doThree: [
          {
            when: function (actor) {
              return actor.canDoThree
            },
            then: function (actor, command) {
              return [
                { type: 'three.one', id: 5 }
              ]
            },
            exclusive: false
          },
          {
            when: function (actor) {
              return actor.canDoThree
            },
            then: function (actor, command) {
              return [
                { type: 'three.two', id: 6 }
              ]
            },
            exclusive: false
          }
        ]
      },
      events: {
        onOne: [
          {
            when: false,
            then: function (actor, event) {
              actor.zero = true
            },
            exclusive: true
          },
          {
            when: true,
            then: function (actor, event) {
              actor.one = true
            },
            exclusive: true
          },
          {
            when: false,
            then: function (actor, event) {
              actor.two = true
            },
            exclusive: true
          }
        ],
        onTwo: [
          {
            when: yep,
            then: function (actor, event) {
              actor.applied = actor.applied || []
              actor.applied.push('two.a')
            },
            exclusive: false
          },
          {
            when: true,
            then: function (actor, event) {
              actor.applied = actor.applied || []
              actor.applied.push('two.b')
            },
            exclusive: false
          }
        ],
        onThree: [
          {
            when: function (actor) {
              return actor.canApplyThree
            },
            then: function (actor, event) {
              actor.applied.push('three')
            }
          }
        ]
      }
    }
  }
}

describe('Apply', () => {
  var actors
  var instance
  before(() => {
    const metadata = createMetadata()
    return loader(fount, metadata)
      .then((list) => {
        actors = list
        instance = actors.test.metadata
      })
  })
  describe('when applying commands', () => {
    describe('with matching exclusive filter', () => {
      it("should result in only the first matching handler's event", () => {
        return apply(actors, queue, 'test.doOne', {}, instance)
          .should.eventually.partiallyEql([
            {
              actor: {
                type: 'test'
              },
              state: {
                id: 1
              },
              original: {
                id: 1
              },
              events: [
                {
                  id: 1,
                  type: 'one.one'
                }
              ],
              message: {}
            }
          ])
      })
    })

    describe('with multiple non-exclusive matching filters', () => {
      it("should result in all matching handlers' events", () => {
        return apply(actors, queue, 'test.doTwo', {}, instance)
          .should.eventually.partiallyEql([
            {
              actor: {
                type: 'test'
              },
              state: {
                id: 1
              },
              original: {
                id: 1
              },
              events: [
                {
                  id: 3,
                  type: 'two.one'
                }
              ],
              message: {}
            },
            {
              actor: {
                type: 'test'
              },
              state: {
                id: 1
              },
              original: {
                id: 1
              },
              events: [
                {
                  id: 4,
                  type: 'two.two'
                }
              ],
              message: {}
            }
          ])
      })
    })

    describe('with no matching filters', () => {
      it('should not result in any events', () => {
        return apply(actors, queue, 'doThree', {}, instance)
          .should.eventually.eql([])
      })
    })
  })

  describe('when applying events', () => {
    describe('with matching exclusive filter', () => {
      before(() => {
        return apply(actors, queue, 'test.onOne', {}, instance)
      })

      it('should apply the event according to the first matching handler only', () => {
        instance.state.should.not.have.property('zero')
        instance.state.should.not.have.property('two')
        instance.state.one.should.equal(true)
      })
    })

    describe('with multiple non-exclusive matching filters', () => {
      before(() => {
        return apply(actors, queue, 'test.onTwo', {}, instance)
      })

      it('should apply the event according to the first matching handler only', () => {
        instance.state.applied.should.eql([ 'two.a', 'two.b' ])
      })
    })

    describe('with no matching filters', () => {
      before(() => {
        return apply(actors, queue, 'test.onThree', {}, instance)
      })

      it('should apply the event according to the first matching handler only', () => {
        instance.state.applied.should.eql([ 'two.a', 'two.b' ])
      })
    })
  })
})
