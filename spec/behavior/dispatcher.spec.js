require( "../setup" );
var dispatcherFn = require( "../../src/dispatch" );

function mockQueue( id, fn ) {
	var queue = { add: function() {} };
	var mock = sinon.mock( queue );
	if ( id ) {
		mock
			.expects( "add" )
			.once()
			.withArgs( id, sinon.match.func )
			.resolves( fn() );
	} else {
		mock
			.expects( "add" )
			.never();
	}
	queue.restore = mock.restore;
	return queue;
}

function mockManager( type, id, result, calls ) {
	var manager = { getOrCreate: function() {}, storeEvents: _.noop };
	var mock = sinon.mock( manager );
	if ( type ) {
		var expectation = mock
			.expects( "getOrCreate" )
			.exactly( calls || 1 )
			.withArgs( type, id );
		if ( result.name ) {
			expectation.rejects( result );
		} else {
			expectation.resolves( result );
		}
	} else {
		mock
			.expects( "getOrCreate" )
			.never();
	}
	manager.restore = mock.restore;
	return manager;
}

describe( "Dispatch", function() {
	describe( "when dispatching unmatched topic", function() {
		var queue, lookup, manager, dispatcher;

		before( function() {
			queue = mockQueue();
			manager = mockManager();
			lookup = {};
			dispatcher = dispatcherFn( lookup, manager, {}, queue );
		} );

		it( "should not queue a task", function() {
			return dispatcher.handle( "badid", "nomatch", {} )
				.should.eventually.eql( [] );
		} );

		after( function() {
			queue.restore();
			manager.restore();
		} );
	} );

	describe( "dispatching with manager error", function() {
		var queue, lookup, manager, dispatcher;

		before( function() {
			var actors = {
				test: {
					metadata: {
						actor: {
							type: "test"
						},
						commands: {
							doAThing: [ [] ]
						}
					}
				}
			};
			queue = mockQueue();
			manager = mockManager( "test", 100, new Error( ":(" ) );
			lookup = { doAThing: [ "test" ] };
			dispatcher = dispatcherFn( lookup, manager, actors, queue );
		} );

		it( "should not queue a task", function() {
			return dispatcher.handle( 100, "doAThing", {} )
				.should.be.rejectedWith( "Failed to instantiate actor \'test\'" );
		} );

		after( function() {
			queue.restore();
			manager.restore();
		} );
	} );

	describe( "dispatching to existing actor", function() {
		var queue, lookup, manager, dispatcher, actors, instance, command, event;

		before( function() {
			actors = {
				test: {
					metadata: {
						actor: {
							type: "test"
						},
						commands: {
							doAThing: [
								[
									function( actor ) {
										return actor.canDo;
									},
									function( actor, thing ) {
										return [ { type: "thingDid", degree: thing.howMuch } ];
									}
								]
							]
						},
						events: {
							thingDid: [
								[ true, function( actor, did ) {
									actor.doneDidfulness = did.degree;
								} ]
							]
						}
					}
				}
			};
			queue = {
				add: function( id, fn ) {
					return when.resolve( fn() );
				}
			};
			instance = _.cloneDeep( actors.test );
			instance.actor = { id: 100, canDo: true, type: "test" };
			command = { type: "doAThing", howMuch: "totes mcgoats" };
			event = { type: "thindDid", degree: "totes mcgoats" };
			manager = mockManager( "test", 100, instance, 2 );
			lookup = {
				doAThing: [ "test" ],
				thingDid: [ "test" ]
			};
			dispatcher = dispatcherFn( lookup, manager, actors, queue );
		} );

		it( "should queue the command successfully", function() {
			return dispatcher.handle( 100, "doAThing", command )
				.should.eventually.partiallyEql(
					[
						{
							actor: instance.actor,
							events: [
								{
									actorType: "test",
									correlationId: 100,
									initiatedBy: "doAThing",
									type: "thingDid",
									degree: "totes mcgoats"
								}
							],
							input: command
						}
					]
				);
		} );

		it( "should queue the event successfully", function() {
			return dispatcher.handle( 100, "thingDid", event )
				.should.eventually.resolve;
		} );

		it( "should mutate actor state", function() {
			instance.actor.doneDidfulness.should.eql( "totes mcgoats" );
		} );

		after( function() {
			manager.restore();
		} );
	} );
} );
