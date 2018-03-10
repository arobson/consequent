require('../setup')
const streamBuilder = require('../../src/streamBuilder')
const EventEmitter = require('events')

const eventAdapter = {
  fetchStream: () => {}
}

function eventEmitter (list) {
  const emitter = new EventEmitter()
  emitter.on('newListener', (e, listener) => {
    if (e === 'event') {
      let totalWait = 0
      list.forEach(i => {
        let wait = i * 10
        totalWait += wait
        setTimeout(() => {
          emitter.emit('event', i)
        }, wait)
      })
      setTimeout(() => {
        emitter.emit('streamComplete')
        emitter.removeListener('event', listener)
        emitter.removeAllListeners('newListener')
      }, totalWait + 100)
    }
  })
  return emitter
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
      this.timeout(5000)
      let builder
      let eventAdapterMock
      let options = {
        actorTypes: [ 'a', 'b', 'c' ],
        sinceDate: Date.parse('01/30/2018')
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
            options.sinceDate
          ).returns(eventEmitter(
            aEvents
          ))

        eventAdapterMock
          .expects('fetchStream')
          .withArgs(
            'b',
            options.sinceDate
          ).returns(eventEmitter(
            bEvents
          ))

        eventAdapterMock
          .expects('fetchStream')
          .withArgs(
            'c',
            options.sinceDate
          ).returns(eventEmitter(
            cEvents
          ))

        builder = streamBuilder(null, null, null, eventAdapter)
        const stream = builder.getEventStream(options)

        stream.on('streamComplete', done)

        stream.on('event', e => {
          events.push(e)
        })
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
})
