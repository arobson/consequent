require('../setup')
const streamBuilder = require('../../src/streamBuilder')

const eventAdapter = {
  fetchStream: () => {}
}

const actorAdapter = {
  fetchByLastEventId: () => {},
  fetchByLastEventDate: () => {},
}

function* generator (list) {
  yield* list
}

describe('StreamBuilder', function () {
  describe('checkQueues', function () {
    let builder

    before(function () {
      builder = streamBuilder()
    })

    it('should validate the number of queues and their depth', function () {
      builder.checkQueues({}, 2, 2).should.equal(false)
      builder.checkQueues({a: [1, 2]}, 2, 2).should.equal(false)
      builder.checkQueues({a: [1, 2], b: []}, 2, 2).should.equal(false)
      builder.checkQueues({a: [1, 2], b: [1]}, 2, 2).should.equal(false)
      builder.checkQueues({a: [1, 2], b: [1, 2]}, 2, 2).should.equal(true)
    })
  })

  describe('checkSetIntersection', function () {
    let builder

    before(function () {
      builder = streamBuilder()
    })

    it('should find intersections between sets', function () {
      builder.checkSetIntersection(
        [],
        []
        ).should.equal(false)
      builder.checkSetIntersection(
        ['a', 'b', 'c'],
        []
        ).should.equal(false)
      builder.checkSetIntersection(
        ['a', 'b', 'c'],
        ['d']
        ).should.equal(false)
      builder.checkSetIntersection(
        ['a', 'b', 'd'],
        ['c']
        ).should.equal(true)
      builder.checkSetIntersection(
        ['d', 'a', 'g'],
        ['b', 'k', 'l']
        ).should.equal(true)
    })
  })

  describe('chooseEvents', function () {
    let builder

    before(function () {
      builder = streamBuilder()
    })

    describe('when one queue has events with lower ids', function () {
      let queues
      let events
      before(function () {
        queues = {
          a: [ { id: 'cd' }, { id: 'ce' } ],
          b: [ { id: 'aa' }, { id: 'ab' } ],
          c: [ { id: 'fg' }, { id: 'fh' } ]
        }

        events = builder.chooseEvents(queues)
      })

      it('should only return one event', function () {
        events.length.should.equal(1)
        events.should.eql([
          { id: 'aa' }
        ])
      })

      it('should remove the event returned', function () {
        queues.b.length.should.equal(1)
        queues.b.should.eql([
          { id: 'ab' }
        ])
      })
    })

    describe('when queue event ids do not intersect', function () {
      let queues
      let events
      before(function () {
        queues = {
          a: [ { id: 'ab' }, { id: 'bg' } ],
          b: [ { id: 'af' }, { id: 'bb' } ],
          c: [ { id: 'ac' }, { id: 'bh' } ]
        }

        events = builder.chooseEvents(queues)
      })

      it('should return ordered events', function () {
        events.length.should.equal(6)
        events.should.eql([
          { id: 'ab' },
          { id: 'ac' },
          { id: 'af' },
          { id: 'bb' },
          { id: 'bg' },
          { id: 'bh' }
        ])
      })

      it('should return emptied queues', function () {
        queues.should.eql({
          a: [],
          b: [],
          c: []
        })
      })
    })
  })

  describe('getEventStream', function () {
    describe('when using sinceDate', function () {
      let builder
      let eventAdapterMock
      let options = {
        actorTypes: [ 'a', 'b', 'c' ],
        since: Date.parse('01/30/2018')
      }
      let eventOptions = {
        since: options.since,
        sinceId: undefined,
        until: undefined,
        untilId: undefined,
        filter: undefined
      }
      let aEvents
      let bEvents
      let cEvents
      let events = []

      before(function (done) {
        aEvents = [
          { id: 'a1' },
          { id: 'b1' },
          { id: 'c1' },
          { id: 'd1' },
          { id: 'e1' }
        ]

        bEvents = [
          { id: 'a2' },
          { id: 'b2' },
          { id: 'c2' },
          { id: 'd2' }
        ]

        cEvents = [
          { id: 'a3' },
          { id: 'b3' },
          { id: 'c3' }
        ]

        eventAdapterMock = sinon.mock(eventAdapter)

        eventAdapterMock
          .expects('fetchStream')
          .withArgs(
            'a',
            '1',
            eventOptions
          ).returns(generator(
            aEvents
          ))

        eventAdapterMock
          .expects('fetchStream')
          .withArgs(
            'b',
            '1',
            eventOptions
          ).returns(generator(
            bEvents
          ))

        eventAdapterMock
          .expects('fetchStream')
          .withArgs(
            'c',
            '1',
            eventOptions
          ).returns(generator(
            cEvents
          ))

        const manager = {
          models: {
            a: { actor: {} },
            b: { actor: {} },
            c: { actor: {} }
          }
        }

        builder = streamBuilder(manager, null, null, eventAdapter)
        const stream = builder.getEventStream('1', options)

        for(const event of stream) {
          events.push(event)
        }
        done()
      })

      it('should return all events in order', function () {
        events.should.eql([
          { id: 'a1' },
          { id: 'a2' },
          { id: 'a3' },
          { id: 'b1' },
          { id: 'b2' },
          { id: 'b3' },
          { id: 'c1' },
          { id: 'c2' },
          { id: 'c3' },
          { id: 'd1' },
          { id: 'd2' },
          { id: 'e1' }
        ])
      })

      after(function () {
        eventAdapterMock.verify()
      })
    })
  })

  describe('getActorStream', function () {
    describe('when using sinceDate', function () {
      let builder
      let eventAdapterMock
      let actorAdapterMock
      let options = {
        since: Date.parse('01/30/2018'),
        eventTypes: ['three.3', 'one.6']
      }
      let eventOptions = {
        since: options.since,
        sinceId: undefined,
        until: undefined,
        untilId: undefined,
        filter: undefined
      }
      let aEvents
      let bEvents
      let cEvents
      let baseline = {
        actor: { type: 'one' },
        state: {
          events: []
        }
      }
      let timeline = []

      before(async function () {
        aEvents = [
          { id: 'a1', type: 'one.1' },
          { id: 'b1', type: 'one.4' },
          { id: 'c1', type: 'one.6' },
        ]

        bEvents = [
          { id: 'a2', type: 'two.2' },
          { id: 'b2', type: 'two.5' },
        ]

        cEvents = [
          { id: 'a3', type: 'three.3' },
        ]

        eventAdapterMock = sinon.mock(eventAdapter)
        actorAdapterMock = sinon.mock(actorAdapter)
        eventAdapterMock
          .expects('fetchStream')
          .withArgs(
            'one',
            '1',
            eventOptions
          ).returns(generator(
            aEvents
          ))

        eventAdapterMock
          .expects('fetchStream')
          .withArgs(
            'two',
            '2',
            eventOptions
          ).returns(generator(
            bEvents
          ))

        eventAdapterMock
          .expects('fetchStream')
          .withArgs(
            'three',
            '2',
            eventOptions
          ).returns(generator(
            cEvents
          ))

        actorAdapterMock
          .expects('fetchByLastEventDate')
          .withArgs(
            '1',
            options.since
          ).resolves(baseline)

        const manager = {
          models: {
            one: { actor: { _actorTypes: [ 'one', 'two', 'three' ]}},
            two: { actor: { _actorTypes: [] } },
            three: { actor: { _actorTypes: [] } }
          },
          getSourceIds: function () {
            return '2'
          }
        }

        const dispatcher = {
          apply: (type, event, baseline) => {
            baseline.state.events.push(event)
          }
        }

        builder = streamBuilder(manager, dispatcher, actorAdapter, eventAdapter)
        const stream = builder.getActorStream('one', '1', options)

        for await(const instance of stream) {
          timeline.push(instance)
        }
      })

      it('should emit copies of state', function () {
        timeline.should.eql([
          { events: []},
          { events: [
            { id: 'a1', type: 'one.1' },
            { id: 'a2', type: 'two.2' },
            { id: 'a3', type: 'three.3' }
          ]},
          { events: [
            { id: 'a1', type: 'one.1' },
            { id: 'a2', type: 'two.2' },
            { id: 'a3', type: 'three.3' },
            { id: 'b1', type: 'one.4' },
            { id: 'b2', type: 'two.5' },
            { id: 'c1', type: 'one.6' }
          ]}
        ])
      })
    })
  })
})
