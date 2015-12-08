require( "../setup" );
var util = require( "../../src/util" );

describe( "Utility/Helpers", function() {
	describe( "when spreading message properties over function parameters", function() {
		function testCall( actor, argOne, argTwo, argThree ) {
			return [ actor, argOne, argTwo, argThree ];
		}

		var model = {
			test: testCall
		};
		var actor = { id: "testing" };

		describe( "with exact matches", function() {
			var message = { argOne: 1, argTwo: "two", argThree: true };
			var result;

			before( function() {
				var fn = util.mapCall( model.test, true );

				result = fn( actor, message );
			} );

			it( "should call the function with correct arguments", function() {
				result.should.eql( [ actor, 1, "two", true ] );
			} );
		} );

		describe( "with partial matches and a map", function() {
			describe( "and a map", function() {
				var message = { argOne: 1, arg2: "two", argThree: true };
				var result;

				before( function() {
					var fn = util.mapCall( model.test, {
						argTwo: "arg2"
					} );

					result = fn( actor, message );
				} );

				it( "should call the function with correct arguments", function() {
					result.should.eql( [ actor, 1, "two", true ] );
				} );
			} );

			describe( "and no map", function() {
				var message = { argOne: 1, arg2: "two", argThree: true };
				var result;

				before( function() {
					var fn = util.mapCall( model.test, true );

					result = fn( actor, message );
				} );

				it( "should call the function with correct arguments", function() {
					result.should.eql( [ actor, 1, undefined, true ] );
				} );
			} );
		} );

		describe( "with no matches", function() {
			describe( "and a map", function() {
				var message = { arg1: 1, arg2: "two", arg3: true };
				var result;

				before( function() {
					var fn = util.mapCall( model.test, {
						argOne: "arg1",
						argTwo: "arg2",
						argThree: "arg3"
					} );

					result = fn( actor, message );
				} );

				it( "should call the function with correct arguments", function() {
					result.should.eql( [ actor, 1, "two", true ] );
				} );
			} );

			describe( "and no valid map", function() {
				var message = { arg1: 1, arg2: "two", arg3: true };
				var result;

				before( function() {
					var fn = util.mapCall( model.test, true );

					result = fn( actor, message );
				} );

				it( "should call the function with undefined arguments", function() {
					result.should.eql( [ actor, undefined, undefined, undefined ] );
				} );
			} );
		} );
	} );
} );
