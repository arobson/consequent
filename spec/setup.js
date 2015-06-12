var chai = require( 'chai' );
chai.use( require( 'chai-as-promised' ) );
global.should = chai.should();
global.expect = chai.expect;
var _ = global._ = require( 'lodash' );
global.when = require( 'when' );
global.lift = require( 'when/node' ).lift;
global.seq = require( 'when/sequence' );
global.fs = require( 'fs' );

function onError() {
	return {};
}

global.onError = onError;
