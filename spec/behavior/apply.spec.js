require( "../setup" );
var apply = require( "../../src/apply" );
var loader = require( "../../src/loader" );
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
			actor: {
				type: "test"
			},
			state: {
				id: 1
			},
			commands: {
				doOne: [
					{
						when: nope,
						then: function( actor, command ) {
							return [
								{ type: "one.zero", id: 1 }
							];
						}
					},
					{
						when: yep,
						then: function( actor, command ) {
							return [
								{ type: "one.one", id: 1 }
							];
						}
					},
					{
						when: yep,
						then: function( actor, command ) {
							return [
								{ type: "one.two", id: 2 }
							];
						}
					}
				],
				doTwo: [
					{
						when: yep,
						then: function( actor, command ) {
							return [
								{ type: "two.one", id: 3 }
							];
						},
						exclusive: false
					},
					{
						then: function( actor, command ) {
							return [
								{ type: "two.two", id: 4 }
							];
						},
						exclusive: false
					}
				],
				doThree: [
					{
						when: function( actor ) {
							return actor.canDoThree;
						},
						then: function( actor, command ) {
							return [
								{ type: "three.one", id: 5 }
							];
						},
						exclusive: false
					},
					{
						when: function( actor ) {
							return actor.canDoThree;
						},
						then: function( actor, command ) {
							return [
								{ type: "three.two", id: 6 }
							];
						},
						exclusive: false
					}
				]
			},
			events: {
				onOne: [
					{
						when: false,
						then: function( actor, event ) {
							actor.zero = true;
						},
						exclusive: true
					},
					{
						when: true,
						then: function( actor, event ) {
							actor.one = true;
						},
						exclusive: true
					},
					{
						when: false,
						then: function( actor, event ) {
							actor.two = true;
						},
						exclusive: true
					}
				],
				onTwo: [
					{
						when: yep,
						then: function( actor, event ) {
							actor.applied = actor.applied || [];
							actor.applied.push( "two.a" );
						},
						exclusive: false
					},
					{
						when: true,
						then: function( actor, event ) {
							actor.applied = actor.applied || [];
							actor.applied.push( "two.b" );
						},
						exclusive: false
					}
				],
				onThree: [
					{
						when: function( actor ) {
							return actor.canApplyThree;
						},
						then: function( actor, event ) {
							actor.applied.push( "three" );
						}
					}
				]
			}
		}
	};
}

describe( "Apply", function() {
	var actors;
	var instance;
	before( function() {
		var metadata = createMetadata();
		return loader( metadata )
			.then( function( list ) {
				actors = list;
				instance = actors.test.metadata;
			} );
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
				instance.state.should.not.have.property( "zero" );
				instance.state.should.not.have.property( "two" );
				instance.state.one.should.be.true;
			} );
		} );

		describe( "with multiple non-exclusive matching filters", function() {
			before( function() {
				return apply( actors, queue, "onTwo", {}, instance );
			} );

			it( "should apply the event according to the first matching handler only", function() {
				instance.state.applied.should.eql( [ "two.a", "two.b" ] );
			} );
		} );

		describe( "with no matching filters", function() {
			before( function() {
				return apply( actors, queue, "onThree", {}, instance );
			} );

			it( "should apply the event according to the first matching handler only", function() {
				instance.state.applied.should.eql( [ "two.a", "two.b" ] );
			} );
		} );
	} );
} );
