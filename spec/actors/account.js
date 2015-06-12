module.exports = function() {
	return {
		actor:
		{
			// user supplied, standard fields */
			type: 'account',
			eventThreshold: 5,
			accountHolder: '',
			balance: 0,
			transactions: []
		},
		commands:
		{
			'*': {
				'account.open': function( actor, command ) {},
				'account.close': function( actor, command ) {}
			},
			'opened':
			{
				'account.deposit': function( actor, command ) {},
				'account.withdraw': function( actor, command ) {}
			},
			'nsf':
			{
				'account.deposit': function( actor, command ) {},
				'account.withdraw': function( actor, command ) {}
			}
		},
		events:
		{
			'*': {
				'account.opened': function( actor, command ) {},
				'account.closed': function( actor, command ) {},
				'account.deposit.made': function( actor, command ) {},
				'account.withdrawal.made': function( actor, command ) {}
			}
		}
	};
};
