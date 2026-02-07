import { describe, it, expect, beforeAll } from 'vitest'
import apply from '../../src/apply.js'
import loader from '../../src/loader.js'
import { fount } from 'fount'
import { queue as hashqueue } from 'haberdasher'

const queue = hashqueue.create(4)

function yep() {
  return true
}
function nope() {
  return false
}

function createMetadata() {
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
            then: function (_actor: any, _command: any) {
              return [
                { type: 'one.zero', id: 1 }
              ]
            }
          },
          {
            when: yep,
            then: function (_actor: any, _command: any) {
              return [
                { type: 'one.one', id: 1 }
              ]
            }
          },
          {
            when: yep,
            then: function (_actor: any, _command: any) {
              return [
                { type: 'one.two', id: 2 }
              ]
            }
          }
        ],
        doTwo: [
          {
            when: yep,
            then: function (_actor: any, _command: any) {
              return [
                { type: 'two.one', id: 3 }
              ]
            },
            exclusive: false
          },
          {
            then: function (_actor: any, _command: any) {
              return [
                { type: 'two.two', id: 4 }
              ]
            },
            exclusive: false
          }
        ],
        doThree: [
          {
            when: function (actor: any) {
              return actor.canDoThree
            },
            then: function (_actor: any, _command: any) {
              return [
                { type: 'three.one', id: 5 }
              ]
            },
            exclusive: false
          },
          {
            when: function (actor: any) {
              return actor.canDoThree
            },
            then: function (_actor: any, _command: any) {
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
            then: function (actor: any) {
              actor.zero = true
            },
            exclusive: true
          },
          {
            when: true,
            then: function (actor: any) {
              actor.one = true
            },
            exclusive: true
          },
          {
            when: false,
            then: function (actor: any) {
              actor.two = true
            },
            exclusive: true
          }
        ],
        onTwo: [
          {
            when: yep,
            then: function (actor: any) {
              actor.applied = actor.applied || []
              actor.applied.push('two.a')
            },
            exclusive: false
          },
          {
            when: true,
            then: function (actor: any) {
              actor.applied = actor.applied || []
              actor.applied.push('two.b')
            },
            exclusive: false
          }
        ],
        onThree: [
          {
            when: function (actor: any) {
              return actor.canApplyThree
            },
            then: function (actor: any) {
              actor.applied.push('three')
            }
          }
        ]
      }
    }
  }
}

describe('Apply', () => {
  let actors: any
  let instance: any
  beforeAll(async () => {
    const metadata = createMetadata()
    const list = await loader(fount, metadata as any)
    actors = list
    instance = actors.test.metadata
  })

  describe('when applying commands', () => {
    describe('with matching exclusive filter', () => {
      it("should result in only the first matching handler's event", async () => {
        const result = await apply(actors, queue, 'test.doOne', {}, instance)
        expect(result).toPartiallyEqual([
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
      it("should result in all matching handlers' events", async () => {
        const result = await apply(actors, queue, 'test.doTwo', {}, instance)
        expect(result).toPartiallyEqual([
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
      it('should not result in any events', async () => {
        const result = await apply(actors, queue, 'doThree', {}, instance)
        expect(result).toEqual([])
      })
    })
  })

  describe('when applying events', () => {
    describe('with matching exclusive filter', () => {
      beforeAll(async () => {
        await apply(actors, queue, 'test.onOne', {}, instance)
      })

      it('should apply the event according to the first matching handler only', () => {
        expect(instance.state).not.toHaveProperty('zero')
        expect(instance.state).not.toHaveProperty('two')
        expect(instance.state.one).toBe(true)
      })
    })

    describe('with multiple non-exclusive matching filters', () => {
      beforeAll(async () => {
        await apply(actors, queue, 'test.onTwo', {}, instance)
      })

      it('should apply the event according to the first matching handler only', () => {
        expect(instance.state.applied).toEqual(['two.a', 'two.b'])
      })
    })

    describe('with no matching filters', () => {
      beforeAll(async () => {
        await apply(actors, queue, 'test.onThree', {}, instance)
      })

      it('should apply the event according to the first matching handler only', () => {
        expect(instance.state.applied).toEqual(['two.a', 'two.b'])
      })
    })
  })
})
