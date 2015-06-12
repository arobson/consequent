require( '../setup' );
var loader = require( '../../src/loader' );

describe( 'Loading Actors', function() {
	describe( 'with bad path', function() {
		it( 'should result in an error', function() {
			return loader( './noSuch' ).should.eventually.be.rejectedWith( 'Could not load actors from non-existent path "/git/labs/consequent/noSuch"' );
		} );
	} );

	describe( 'with valid path', function() {
		var actors;
		it( 'should result in an error', function() {
			return loader( './spec/actors' ).should.be.fulfilled.then( function( result ) {
				actors = result;
				result.should.have.property( 'account' );
			} );
		} );

		it( 'should return valid factory', function() {
			return actors.account.fn().should.eventually.include.keys( [ 'actor', 'commands', 'events' ] );
		} );
	} );
} );
