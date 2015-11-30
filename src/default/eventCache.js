var when = require( "when" );

module.exports = function() {
	return {
		create: function() {
			return {
				getEventsFor: function() {
					return when.resolve( [] );
				},
				getEventPackFor: function() {
					return when.resolve( undefined );
				},
				storeEvents: function() {
					return when();
				},
				storeEventPackFor: function() {
					return when();
				}
			};
		}
	};
};
