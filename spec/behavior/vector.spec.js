require('../setup')

const vector = require('../../src/vector')

describe('Vector', function () {
  describe('when parsing vectors', function () {
    it('should parse empty vector correcty', function () {
      vector.parse('').should.eql({})
    })

    it('should parse partially empty vector correcty', function () {
      vector.parse(';a:1').should.eql({a: 1})
    })

    it('should parse vectors correctly', function () {
      vector.parse('a:2;b:1').should.eql({a: 2, b: 1})
      vector.parse('c:3;a:2;b:1').should.eql({a: 2, b: 1, c: 3})
    })
  })

  describe('when stringifying', function () {
    it('should stringify empty vectors correctly', function () {
      vector.stringify({}).should.eql('')
    })

    it('should stringify vecotrs', function () {
      vector.stringify({a: 1}).should.eql('a:1')
      vector.stringify({a: 1, b: 2}).should.eql('a:1;b:2')
      vector.stringify({c: 3, a: 1, b: 2}).should.eql('a:1;b:2;c:3')
    })
  })

  describe('when incrementing', function () {
    it('should increment empty vector correctly', function () {
      let v = {}
      vector.increment(v, 'a')
      v.should.eql({a: 1})
    })

    it('should increment vector correctly', function () {
      let v = {a: 1}
      vector.increment(v, 'a')
      v.should.eql({a: 2})
      vector.increment(v, 'b')
      v.should.eql({a: 2, b: 1})
      vector.increment(v, 'c')
      vector.increment(v, 'c')
      vector.increment(v, 'c')
      v.should.eql({a: 2, b: 1, c: 3})
    })
  })

  describe('when getting version', function () {
    it('should get empty vector version correctly', function () {
      vector.toVersion('').should.eql(0)
    })

    it('should parse vector correctly', function () {
      vector.toVersion('a:1').should.eql(1)
      vector.toVersion('a:1;b:4').should.eql(5)
      vector.toVersion('a:1;b:4;c:7').should.eql(12)
    })
  })
})
