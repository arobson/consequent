require('../setup')
const loader = require('../../src/loader')
const fount = require('fount')
const path = require('path')

describe('Loading Actors', () => {
  describe('with bad path', () => {
    it('should result in an error', () =>
      loader(fount, './noSuch')
        .should.eventually.be
        .rejectedWith(
          `Could not load actors from non-existent path '${path.resolve('./')}/noSuch'`
        )
    )
  })

  describe('with valid path', () => {
    var actors
    before(() => {
      return loader(fount, './spec/actors')
        .then((res) => {
          actors = res
        })
    })

    it('should resolve with actors', () =>
      actors.should.have.property('account')
    )

    it('should return valid factory', () =>
      actors.account.metadata.should.include.keys([ 'actor', 'commands', 'events' ])
    )
  })
})
