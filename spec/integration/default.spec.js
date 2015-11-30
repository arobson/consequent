require( "../setup" );

var fn = require( "../../src/index" );

describe( "Consequent Example", function() {
	var consequent;
	before( function() {
		return fn( {
			actors: "./spec/actors"
		} ).then( function( x ) {
			consequent = x;
		} );
	} );

	describe( "when fetching for missing record", function() {
		it( "should result in a blank instance", function() {
			return consequent.fetch( "account", "0000001" )
				.should.eventually.partiallyEql( { actor:
					{
						balance: 0,
						eventThreshold: 5,
						holder: "",
						namespace: "ledger",
						number: "",
						open: false,
						transactions: [],
						type: "account"
					}
				} );
		} );
	} );

	describe( "when handling commands ", function() {
		describe( "with a create command", function() {
			var events = [];
			var command = {
				type: "account.open",
				accountHolder: "Test User",
				accountNumber: "0000001",
				initialDeposit: 100
			};
			before( function() {
				return consequent.handle( "0000001", "account.open", command )
					.then( function( result ) {
						events = result;
					}, console.log );
			} );

			it( "should produce opened and deposited events", function() {
				return events.should.partiallyEql( [
					{
						input: command,
						actor: {
							id: "0000001",
							balance: 0
						},
						events: [
							{
								type: "opened",
								accountHolder: "Test User",
								accountNumber: "0000001"
							},
							{
								type: "deposited",
								initial: true,
								amount: 100
							}
						]
					}
				] );
			} );
		} );
	} );
} );
