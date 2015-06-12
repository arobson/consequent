require( '../setup' );
var dispatcherFn = require( '../../src/dispatch' );
var sinon = require( 'sinon' );

function mockQueue( id, result ) {
	var queue = { add: function() {} };
	var mock = sinon.mock( queue );
	if ( id ) {
		mock
			.expects( 'add' )
			.once()
			.withArgs( id, sinon.match.func )
			.returns( result );
	} else {
		mock
			.expects( 'add' )
			.never();
	}
	queue.restore = mock.restore;
	return queue;
}

function mockManager( type, id, result ) {
	var manager = { getOrCreate: function() {} };
	var mock = sinon.mock( manager );
	if ( type ) {
		mock
			.expects( 'getOrCreate' )
			.once()
			.withArgs( type, id )
			.returns( result );
	} else {
		mock
			.expects( 'getOrCreate' )
			.never();
	}
	manager.restore = mock.restore;
	return manager;
}

describe( 'Dispatch', function() {
	describe( 'dispatching unmatched topic', function() {
		var queue, lookup, manager, dispatcher;

		before( function() {
			queue = mockQueue();
			manager = mockManager();
			lookup = {};
			dispatcher = dispatcherFn( lookup, manager, queue );
		} );

		it( 'should not queue a task', function() {
			return dispatcher.handle( 'fartwheef', 'durpleurple', {} )
				.should.eventually.eql( [] );
		} );

		after( function() {
			queue.restore();
			manager.restore();
		} );
	} );

	describe( 'dispatching with manager error', function() {
		var queue, lookup, manager, dispatcher;

		before( function() {
			queue = mockQueue();
			manager = mockManager( 'derfle', 100, when.reject( new Error( ':(' ) ) );
			lookup = { 'durpleurple': [ 'derfle' ] };
			dispatcher = dispatcherFn( lookup, manager, queue );
		} );

		it( 'should not queue a task', function() {
			return dispatcher.handle( 100, 'durpleurple', {} )
				.should.eventually.eql(
				[
					{
						'reason': 'Error: :(',
						'state': 'rejected'
					}
				] );
		} );

		after( function() {
			queue.restore();
			manager.restore();
		} );
	} );

	describe( 'dispatching to existing actor', function() {

	} );

	describe( 'dispatching to non-existent actor', function() {} );
} );
