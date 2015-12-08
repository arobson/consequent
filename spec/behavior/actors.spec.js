require( "../setup" );
var loader = require( "../../src/loader" );
var actorFn = require( "../../src/actors" );

var store = {
	fetch: _.noop,
	store: _.noop
};

var cache = {
	fetch: _.noop,
	store: _.noop
};

describe( "Actors", function() {
	var actors;
	before( function() {
		return loader( "./spec/actors" )
			.then( function( list ) {
				actors = list;
			} );
	} );

	describe( "when fetching an actor", function() {
		var actor;
		before( function() {
			actor = actorFn( actors, {}, {} );
			actor.adapters.store.account = store;
			actor.adapters.cache.account = cache;
		} );

		describe( "and cached snapshot exists", function() {
			var cacheMock, storeMock, account;

			before( function() {
				account = {
					id: 1010
				};

				cacheMock = sinon.mock( cache );
				cacheMock.expects( "fetch" )
					.withArgs( 1010 )
					.resolves( account );
				storeMock = sinon.mock( store );
				storeMock.expects( "fetch" ).never();
			} );

			it( "should resolve fetch with instance", function() {
				return actor.fetch( "account", 1010 )
					.should.eventually.partiallyEql( { state: account } );
			} );

			it( "should call cache fetch", function() {
				cacheMock.verify();
			} );

			it( "should not call store fetch", function() {
				storeMock.verify();
			} );
		} );

		describe( "and cache read throws an error", function() {
			var cacheMock, storeMock, account;

			before( function() {
				account = {
					id: 1010
				};

				cacheMock = sinon.mock( cache );
				cacheMock.expects( "fetch" )
					.withArgs( 1010 )
					.rejects( new Error( "bad juju" ) );
				storeMock = sinon.mock( store );
				storeMock.expects( "fetch" )
					.withArgs( 1010 )
					.resolves( account );
			} );

			it( "should resolve fetch with instance", function() {
				return actor.fetch( "account", 1010 )
					.should.eventually.partiallyEql( { state: account } );
			} );

			it( "should call cache fetch", function() {
				cacheMock.verify();
			} );

			it( "should call store fetch", function() {
				storeMock.verify();
			} );
		} );

		describe( "and cache misses", function() {
			describe( "and no snapshot exists", function() {
				var cacheMock, storeMock, account;

				before( function() {
					account = {
						id: 1010
					};

					cacheMock = sinon.mock( cache );
					cacheMock.expects( "fetch" )
						.withArgs( 1010 )
						.resolves( undefined );
					storeMock = sinon.mock( store );
					storeMock.expects( "fetch" )
						.withArgs( 1010 )
						.resolves( undefined );
				} );

				it( "should resolve fetch with instance", function() {
					return actor.fetch( "account", 1010 )
						.should.eventually.partiallyEql( { state: account } );
				} );

				it( "should call cache fetch", function() {
					cacheMock.verify();
				} );

				it( "should call store fetch", function() {
					storeMock.verify();
				} );
			} );

			describe( "and store read throws an error", function() {
				var cacheMock, storeMock, account;

				before( function() {
					account = {
						id: 1010,
						type: "account"
					};

					cacheMock = sinon.mock( cache );
					cacheMock.expects( "fetch" )
						.withArgs( 1010 )
						.resolves( undefined );
					storeMock = sinon.mock( store );
					storeMock.expects( "fetch" )
						.withArgs( 1010 )
						.rejects( new Error( "This is bad" ) );
				} );

				it( "should resolve fetch with instance", function() {
					return actor.fetch( "account", 1010 )
						.should.be.rejectedWith( "Failed to get instance '1010' of 'account' from store with Error: This is bad" );
				} );

				it( "should call cache fetch", function() {
					cacheMock.verify();
				} );

				it( "should call store fetch", function() {
					storeMock.verify();
				} );
			} );

			describe( "and store has the snapshot", function() {
				var cacheMock, storeMock, account;

				before( function() {
					account = {
						id: 1010
					};

					cacheMock = sinon.mock( cache );
					cacheMock.expects( "fetch" )
						.withArgs( 1010 )
						.resolves( undefined );
					storeMock = sinon.mock( store );
					storeMock.expects( "fetch" )
						.withArgs( 1010 )
						.resolves( account );
				} );

				it( "should resolve fetch with instance", function() {
					return actor.fetch( "account", 1010 )
						.should.eventually.partiallyEql( { state: account } );
				} );

				it( "should call cache fetch", function() {
					cacheMock.verify();
				} );

				it( "should call store fetch", function() {
					storeMock.verify();
				} );
			} );
		} );
	} );

	describe( "when storing snapshot", function() {
		var actor;
		before( function() {
			actor = actorFn( actors, {}, {}, "a" );
			actor.adapters.store.account = store;
			actor.adapters.cache.account = cache;
		} );

		describe( "when store and cache are successful", function() {
			var storeMock, cacheMock, account;
			before( function() {
				account = {
					id: 1001,
					vector: "a:1"
				};
				cacheMock = sinon.mock( cache );
				cacheMock.expects( "store" )
					.withArgs( 1001, "a:2", account )
					.resolves( account );
				storeMock = sinon.mock( store );
				storeMock.expects( "store" )
					.withArgs( 1001, "a:2", account )
					.resolves( account );
			} );

			it( "should resolve store call", function() {
				return actor.store( { actor: { type: "account" }, state: account } )
					.should.eventually.eql( account );
			} );

			it( "should store snapshot", function() {
				storeMock.verify();
			} );

			it( "should cache snapshot", function() {
				cacheMock.verify();
			} );
		} );

		describe( "when store fails", function() {
			var storeMock, cacheMock, account;
			before( function() {
				account = {
					id: 1001,
					vector: "a:1"
				};
				cacheMock = sinon.mock( cache );
				cacheMock.expects( "store" ).never();
				storeMock = sinon.mock( store );
				storeMock.expects( "store" )
					.withArgs( 1001, "a:2", account )
					.rejects( new Error( "fail whale" ) );
			} );

			it( "should resolve store call", function() {
				return actor.store( { actor: { type: "account" }, state: account } )
					.should.be.rejectedWith( "Failed to store actor '1001' of 'account' with Error: fail whale" );
			} );

			it( "should store snapshot", function() {
				storeMock.verify();
			} );

			it( "should not cache snapshot", function() {
				cacheMock.verify();
			} );
		} );

		describe( "when cache fails", function() {
			var storeMock, cacheMock, account;
			before( function() {
				account = {
					id: 1001,
					vector: "a:1"
				};
				cacheMock = sinon.mock( cache );
				cacheMock.expects( "store" )
					.withArgs( 1001, "a:2", account )
					.rejects( new Error( "No cache for you" ) );
				storeMock = sinon.mock( store );
				storeMock.expects( "store" )
					.withArgs( 1001, "a:2", account )
					.resolves( account );
			} );

			it( "should resolve store call", function() {
				return actor.store( { actor: { type: "account" }, state: account } )
					.should.be.rejectedWith( "Failed to cache actor '1001' of 'account' with Error: No cache for you" );
			} );

			it( "should store snapshot", function() {
				storeMock.verify();
			} );

			it( "should not cache snapshot", function() {
				cacheMock.verify();
			} );
		} );
	} );
} );
