require( "../setup" );
var loader = require( "../../src/loader" );

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

var actorAdapter = {
	fetch: _.noop,
	findAncestor: _.noop,
	store: _.noop
};

var eventAdapter = {
	fetch: _.noop,
	storePack: _.noop
};

var applySpy = sinon.spy( function( a, q, t, e, x ) {
	x.applied = x.applied || [];
	x.applied.push( e );
	return when();
} );

var managerFn = proxyquire( "../src/manager", {
	"./apply": applySpy
} );

describe( "Manager", function() {
	var actors;
	before( function() {
		return loader( "./spec/actors" )
			.then( function( list ) {
				actors = list;
			} );
	} );
	describe( "when actor fetch fails", function() {
		var actorMock, manager;
		before( function() {
			actorMock = sinon.mock( actorAdapter );
			actorMock.expects( "fetch" )
				.withArgs( "account", 100 )
				.rejects( new Error( "Nope sauce" ) );
			manager = managerFn( actors, actorAdapter, eventAdapter, mockQueue() );
		} );

		it( "should reject with an error", function() {
			return manager.getOrCreate( "account", 100 )
				.should.be.rejectedWith( "Nope sauce" );
		} );

		it( "should call fetch on actor adapter", function() {
			actorMock.verify();
		} );
	} );

	describe( "when single actor instance exists", function() {
		var actorMock, eventMock, manager, actor, state, events;
		before( function() {
			state = {
				lastEventId: 1,
				id: 100
			};
			actor = {
				type: "account"
			};
			events = [ { id: 2 }, { id: 3 } ];
			var instance = {
				actor: actor,
				state: state
			};
			actorMock = sinon.mock( actorAdapter );
			actorMock.expects( "fetch" )
				.withArgs( "account", 100 )
				.resolves( instance );
			actorMock.expects( "store" ).never();
			eventMock = sinon.mock( eventAdapter );
			eventMock.expects( "fetch" )
				.withArgs( "account", 100, 1 )
				.resolves( events );
			eventMock.expects( "storePack" ).never();

			manager = managerFn( actors, actorAdapter, eventAdapter, mockQueue() );
		} );

		it( "should result in updated actor", function() {
			return manager.getOrCreate( "account", 100 )
				.should.eventually.eql( {
					state: state,
					actor: actor,
					applied: events
				} );
		} );

		it( "should call fetch on actor adapter", function() {
			actorMock.verify();
		} );

		it( "should call fetch on event adapter", function() {
			eventMock.verify();
		} );
	} );

	describe( "when multiple actor instances exist", function() {
		var actorMock, eventMock, manager, instances, actor, state, events;
		before( function() {
			actor = { type: "account" };
			instances = [
				{
					actor: actor,
					state: {
						lastEventId: 4,
						id: 100
					}
				},
				{
					actor: actor,
					state: {
						lastEventId: 5,
						id: 100
					}
				}
			];
			state = {
				lastEventId: 1,
				id: 100
			};
			events = [ { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 } ];
			var instance = {
				actor: actor,
				state: state
			};
			actorMock = sinon.mock( actorAdapter );
			actorMock.expects( "fetch" )
				.withArgs( "account", 100 )
				.resolves( instances );
			actorMock.expects( "findAncestor" )
				.withArgs( 100, instances, [] )
				.resolves( instance );
			actorMock.expects( "store" ).never();
			eventMock = sinon.mock( eventAdapter );
			eventMock.expects( "fetch" )
				.withArgs( "account", 100, 1 )
				.resolves( events );
			eventMock.expects( "storePack" ).never();

			manager = managerFn( actors, actorAdapter, eventAdapter, mockQueue() );
		} );

		it( "should result in updated actor", function() {
			return manager.getOrCreate( "account", 100 )
				.should.eventually.eql( {
					actor: actor,
					state: state,
					applied: events
				} );
		} );

		it( "should call fetch on actor adapter", function() {
			actorMock.verify();
		} );

		it( "should call fetch on event adapter", function() {
			eventMock.verify();
		} );
	} );

	describe( "when event threshold is exceeded", function() {
		describe( "in normal mode", function() {
			var actorMock, eventMock, manager, actor, state, events;
			before( function() {
				actor = {
					type: "account",
					eventThreshold: 2
				};
				state = {
					lastEventId: 1,
					id: 100
				};
				events = [ { id: 2 }, { id: 3 } ];
				var instance = {
					actor: actor,
					state: state
				};
				actorMock = sinon.mock( actorAdapter );
				actorMock.expects( "fetch" )
					.withArgs( "account", 100 )
					.resolves( instance );
				actorMock.expects( "store" )
					.withArgs( instance )
					.once()
					.resolves( {} );
				eventMock = sinon.mock( eventAdapter );
				eventMock.expects( "fetch" )
					.withArgs( "account", 100, 1 )
					.resolves( events );
				eventMock.expects( "storePack" )
					.withArgs( "account", state.id, undefined, 1, events )
					.once()
					.resolves();

				manager = managerFn( actors, actorAdapter, eventAdapter, mockQueue() );
			} );

			it( "should result in updated actor", function() {
				return manager.getOrCreate( "account", 100 )
					.should.eventually.eql( {
						actor: actor,
						state: state,
						applied: events
					} );
			} );

			it( "should call fetch on actor adapter", function() {
				actorMock.verify();
			} );

			it( "should call fetch on event adapter", function() {
				eventMock.verify();
			} );
		} );

		describe( "in readOnly without snapshotOnRead", function() {
			var actorMock, eventMock, manager, actor, state, events;
			before( function() {
				actor = {
					type: "account",
					eventThreshold: 2
				};
				state = {
					lastEventId: 1,
					id: 100
				};
				events = [ { id: 2 }, { id: 3 } ];
				var instance = {
					actor: actor,
					state: state
				};
				actorMock = sinon.mock( actorAdapter );
				actorMock.expects( "fetch" )
					.withArgs( "account", 100 )
					.resolves( instance );
				actorMock.expects( "store" ).never();
				eventMock = sinon.mock( eventAdapter );
				eventMock.expects( "fetch" )
					.withArgs( "account", 100, 1 )
					.resolves( events );
				eventMock.expects( "storePack" ).never();

				manager = managerFn( actors, actorAdapter, eventAdapter, mockQueue() );
			} );

			it( "should result in updated actor", function() {
				return manager.getOrCreate( "account", 100, true )
					.should.eventually.eql( {
						actor: actor,
						state: state,
						applied: events
					} );
			} );

			it( "should call fetch on actor adapter", function() {
				actorMock.verify();
			} );

			it( "should call fetch on event adapter", function() {
				eventMock.verify();
			} );
		} );

		describe( "in readOnly with snapshotOnRead", function() {
			var actorMock, eventMock, manager, actor, state, events;
			before( function() {
				actor = {
					type: "account",
					eventThreshold: 2,
					snapshotOnRead: true
				};
				state = {
					lastEventId: 1,
					id: 100
				};
				events = [ { id: 2 }, { id: 3 } ];
				var instance = {
					actor: actor,
					state: state
				};
				actorMock = sinon.mock( actorAdapter );
				actorMock.expects( "fetch" )
					.withArgs( "account", 100 )
					.resolves( instance );
				actorMock.expects( "store" )
					.withArgs( instance )
					.once()
					.resolves( {} );
				eventMock = sinon.mock( eventAdapter );
				eventMock.expects( "fetch" )
					.withArgs( "account", 100, 1 )
					.resolves( events );
				eventMock.expects( "storePack" )
					.withArgs( "account", state.id, undefined, 1, events )
					.once()
					.resolves();

				manager = managerFn( actors, actorAdapter, eventAdapter, mockQueue() );
			} );

			it( "should result in updated actor", function() {
				return manager.getOrCreate( "account", 100, true )
					.should.eventually.eql( {
						actor: actor,
						state: state,
						applied: events
					} );
			} );

			it( "should call fetch on actor adapter", function() {
				actorMock.verify();
			} );

			it( "should call fetch on event adapter", function() {
				eventMock.verify();
			} );
		} );
	} );
} );
