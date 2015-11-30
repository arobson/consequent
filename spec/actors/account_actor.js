var account = require( "./account" );

module.exports = function() {
	return {
		actor: {
			// user supplied, standard fields */
			namespace: "ledger",
			type: "account",
			eventThreshold: 5,
			// model
			number: "",
			holder: "",
			balance: 0,
			open: false,
			transactions: []
		},
		commands: {
			open: [ [ true, account.open, false, true ] ],
			close: [ [ true, account.close ] ],
			deposit: [
				[ account.open, account.deposit, true ],
				[ true, _.noop, true ]
			],
			withdraw: [
				[ account.canWithdraw, account.withdraw, true ],
				[ true, _.noop, true ]
			]
		},
		events: {
			opened: [ [ true, account.opened ] ],
			closed: [ [ true, account.closed ] ],
			deposited: [ [ true, account.deposited ] ],
			withdrawn: [ [ true, account.withdrawn ] ]
		}
	};
};
