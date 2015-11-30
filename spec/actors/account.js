
function close() {
	return {
		type: "closed"
	};
}

function deposit( account, amount ) {
	return {
		type: "deposited",
		amount: amount
	};
}

function open( account, accountHolder, accountNumber, initialDeposit ) {
	return [
		{
			type: "opened",
			accountHolder: accountHolder,
			accountNumber: accountNumber
		},
		{
			type: "deposited",
			initial: true,
			amount: initialDeposit
		}
	];
}

function canWithdraw( account, withdrawal ) {
	return account.open &&
		account.balance >= withdrawal.amount;
}

function withdraw( account, amount ) {
	var events = [];
	events.push( {
		type: "withdrawn",
		amount: amount
	} );
	return events;
}

function onOpen( account, accountHolder, accountNumber ) {
	account.holder = accountHolder;
	account.number = accountNumber;
	account.open = true;
}

function onClose( account ) {
	account.transactions.push( { credit: 0, debit: account.balance } );
	account.balance = 0;
	account.open = false;
}

function onDeposit( account, transaction ) {
	account.balance += transaction.amount;
	account.transactions.push( { credit: transaction.amount, debit: 0 } );
}

function onWithdraw( account, transaction ) {
	account.balance -= transaction.amount;
	account.transactions.push( { credit: 0, debit: transaction.amount } );
}

module.exports = {
	canWithdraw: canWithdraw,

	close: close,
	deposit: deposit,
	open: open,
	withdraw: withdraw,

	closed: onClose,
	deposited: onDeposit,
	opened: onOpen,
	withdrawn: onWithdraw
};
