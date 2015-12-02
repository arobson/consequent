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
			close: [ [ true, account.close, false, true ] ],
			deposit: [
				[ account.open, account.deposit, true, true ],
				[ true, _.noop, true ]
			],
			withdraw: [
				[ account.canWithdraw, account.withdraw, true, true ],
				[ true, _.noop, true ]
			]
		},
		events: {
			opened: [ [ true, account.opened, false, true ] ],
			closed: [ [ true, account.closed, false, true ] ],
			deposited: [ [ true, account.deposited, false, false ] ],
			withdrawn: [ [ true, account.withdrawn, false, false ] ]
		}
	};
};
