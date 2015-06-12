require( '../setup' );
var subscriptions = require( '../../src/subscriptions' );
var loader = require( '../../src/loader' );

describe( 'Subscriptions', function() {
	var actors;
	before( function() {
		return loader( './spec/actors' )
			.then( function( list ) {
				actors = list;
			} );
	} );

	describe( 'when creating subscriptions for actors', function() {
		it( 'should create subscription map', function() {
			subscriptions.getSubscriptions( actors ).should.eql( {
				account: ( [ 'account.open', 'account.close', 'account.opened', 'account.closed', 'account.deposit', 'account.withdraw', 'account.deposit.made', 'account.withdrawal.made', ] ).sort()
			} );
		} );

		it( 'should create topic list', function() {
			subscriptions.getTopics( actors ).should.eql(
				( [ 'account.open', 'account.close', 'account.opened', 'account.closed', 'account.deposit', 'account.withdraw', 'account.deposit.made', 'account.withdrawal.made' ] ).sort()
			);
		} );

		it( 'should create reverse lookup', function() {
			subscriptions.getActorLookup( actors ).should.eql(
				{
					'account.open': [ 'account' ],
					'account.close': [ 'account' ],
					'account.opened': [ 'account' ],
					'account.closed': [ 'account' ],
					'account.deposit': [ 'account' ],
					'account.withdraw': [ 'account' ],
					'account.deposit.made': [ 'account' ],
					'account.withdrawal.made': [ 'account' ]
				}
			);
		} );
	} );

} );
