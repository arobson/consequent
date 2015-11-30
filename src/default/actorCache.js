var when = require( "when" );

module.exports = function() {
	return {
		create: function() {
			return {
				fetch: function() {
					return when.resolve( undefined );
				},
				store: function() {
					return when();
				}
			};
		}
	};
};
