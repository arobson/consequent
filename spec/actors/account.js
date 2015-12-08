
function close() {
	return {
		type: "account.closed"
	};
}

function deposit( account, amount ) {
	return {
		type: "account.deposited",
		amount: amount
	};
}

function open( account, accountHolder, accountNumber, initialDeposit ) {
	return [
		{
			type: "account.opened",
			accountHolder: accountHolder,
			accountNumber: accountNumber
		},
		{
			type: "account.deposited",
			initial: true,
			amount: initialDeposit
		}
	];
}

function canWithdraw( account, amount ) {
	return account.open &&
		account.balance >= amount;
}

function withdraw( account, amount ) {
	var events = [];
	events.push( {
		type: "account.withdrawn",
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

function onDeposit( account, amount ) {
	account.balance += amount;
	account.transactions.push( { credit: amount, debit: 0 } );
}

function onWithdraw( account, amount ) {
	account.balance -= amount;
	account.transactions.push( { credit: 0, debit: amount } );
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
