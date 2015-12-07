require( "../setup" );
var apply = require( "../../src/apply" );
var hashqueue = require( "hashqueue" );
var queue = hashqueue.create( 4 );

function yep() {
	return true;
 }
function nope() {
	return false;
 }

function createMetadata() {
	return {
		test: {
			metadata: {
				actor: {
					id: 1,
					type: "test"
				},
				commands: {
					doOne: [
						[
							nope,
							function( actor, command ) {
								return [
									{ type: "one.zero", id: 1 }
								];
							},
							true
						],
						[
							yep,
							function( actor, command ) {
								return [
									{ type: "one.one", id: 1 }
								];
							},
							true
						],
						[
							yep,
							function( actor, command ) {
								return [
									{ type: "one.two", id: 2 }
								];
							},
							true
						]
					],
					doTwo: [
						[
							yep,
							function( actor, command ) {
								return [
									{ type: "two.one", id: 3 }
								];
							},
							false
						],
						[
							true,
							function( actor, command ) {
								return [
									{ type: "two.two", id: 4 }
								];
							},
							false
						]
					],
					doThree: [
						[
							function( actor ) {
								return actor.canDoThree;
							},
							function( actor, command ) {
								return [
									{ type: "three.one", id: 5 }
								];
							},
							false
						],
						[
							function( actor ) {
								return actor.canDoThree;
							},
							function( actor, command ) {
								return [
									{ type: "three.two", id: 6 }
								];
							},
							false
						]
					]
				},
				events: {
					onOne: [
						[
							false,
							function( actor, event ) {
								actor.zero = true;
							},
							true
						],
						[
							true,
							function( actor, event ) {
								actor.one = true;
							},
							true
						],
						[
							false,
							function( actor, event ) {
								actor.two = true;
							},
							true
						]
					],
					onTwo: [
						[
							yep,
							function( actor, event ) {
								actor.applied = actor.applied || [];
								actor.applied.push( "two.a" );
							},
							false
						],
						[
							true,
							function( actor, event ) {
								actor.applied = actor.applied || [];
								actor.applied.push( "two.b" );
							},
							false
						]
					],
					onThree: [
						[
							function( actor ) {
								return actor.canApplyThree;
							},
							function( actor, event ) {
								actor.applied.push( "three" );
							},
							false
						]
					]
				}
			}
		}
	};
}

describe( "Apply", function() {
	var actors;
	var instance;
	before( function() {
		actors = createMetadata();
		instance = actors.test.metadata;
	} );
	describe( "when applying commands", function() {
		describe( "with matching exclusive filter", function() {
			it( "should result in only the first matching handler's event", function() {
				return apply( actors, queue, "doOne", {}, instance )
					.should.eventually.eql( [
						{
							actor: {
								id: 1,
								type: "test"
							},
							events: [
								{
									id: 1,
									type: "one.one"
								}
							],
							message: {}
						}
					] );
			} );
		} );

		describe( "with multiple non-exclusive matching filters", function() {
			it( "should result in all matching handlers' events", function() {
				return apply( actors, queue, "doTwo", {}, instance )
					.should.eventually.eql( [
						{
							actor: {
								id: 1,
								type: "test"
							},
							events: [
								{
									id: 3,
									type: "two.one"
								}
							],
							message: {}
						},
						{
							actor: {
								id: 1,
								type: "test"
							},
							events: [
								{
									id: 4,
									type: "two.two"
								}
							],
							message: {}
						}
					] );
			} );
		} );

		describe( "with no matching filters", function() {
			it( "should not result in any events", function() {
				return apply( actors, queue, "doThree", {}, instance )
					.should.eventually.eql( [] );
			} );
		} );
	} );

	describe( "when applying events", function() {
		describe( "with matching exclusive filter", function() {
			before( function() {
				return apply( actors, queue, "onOne", {}, instance );
			} );

			it( "should apply the event according to the first matching handler only", function() {
				instance.actor.should.not.have.property( "zero" );
				instance.actor.should.not.have.property( "two" );
				instance.actor.one.should.be.true;
			} );
		} );

		describe( "with multiple non-exclusive matching filters", function() {
			before( function() {
				return apply( actors, queue, "onTwo", {}, instance );
			} );

			it( "should apply the event according to the first matching handler only", function() {
				instance.actor.applied.should.eql( [ "two.a", "two.b" ] );
			} );
		} );

		describe( "with no matching filters", function() {
			before( function() {
				return apply( actors, queue, "onThree", {}, instance );
			} );

			it( "should apply the event according to the first matching handler only", function() {
				instance.actor.applied.should.eql( [ "two.a", "two.b" ] );
			} );
		} );
	} );
} );
