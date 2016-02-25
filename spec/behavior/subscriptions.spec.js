require( "../setup" );
var subscriptions = require( "../../src/subscriptions" );
var loader = require( "../../src/loader" );
var fount = require( "fount" );

describe( "Subscriptions", function() {
	var actors;
	before( function() {
		return loader( fount, "./spec/actors" )
			.then( function( result ) {
				actors = result;
			} );
	} );

	describe( "when creating subscriptions for actors", function() {
		it( "should create subscription map", function() {
			subscriptions.getSubscriptions( actors ).should.eql( {
				account: {
					commands: [
						"account.open",
						"account.close",
						"account.deposit",
						"account.withdraw"
					],
					events: [
						"account.opened",
						"account.closed",
						"account.deposited",
						"account.withdrawn"
					]
				}
			} );
		} );

		it( "should create topic list", function() {
			subscriptions.getTopics( actors ).should.eql(
				( [
					"account.open",
					"account.close",
					"account.opened",
					"account.closed",
					"account.deposit",
					"account.withdraw",
					"account.deposited",
					"account.withdrawn"
				] ).sort()
			);
		} );

		it( "should create reverse lookup", function() {
			subscriptions.getActorLookup( actors ).should.eql(
				{
					"account.open": [ "account" ],
					"account.close": [ "account" ],
					"account.opened": [ "account" ],
					"account.closed": [ "account" ],
					"account.deposit": [ "account" ],
					"account.withdraw": [ "account" ],
					"account.deposited": [ "account" ],
					"account.withdrawn": [ "account" ]
				}
			);
		} );
	} );
} );
