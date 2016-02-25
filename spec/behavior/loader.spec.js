require( "../setup" );
var loader = require( "../../src/loader" );
var fount = require( "fount" );

describe( "Loading Actors", function() {
	describe( "with bad path", function() {
		it( "should result in an error", function() {
			return loader( fount, "./noSuch" ).should.eventually.be.rejectedWith( "Could not load actors from non-existent path '/git/labs/consequent/noSuch'" );
		} );
	} );

	describe( "with valid path", function() {
		var actors;
		before( function() {
			return loader( fount, "./spec/actors" )
				.then( function( res ) {
					actors = res;
				} );
		} );
		it( "should resolve with actors", function() {
			return actors.should.have.property( "account" );
		} );

		it( "should return valid factory", function() {
			return actors.account.metadata.should.include.keys( [ "actor", "commands", "events" ] );
		} );
	} );
} );
