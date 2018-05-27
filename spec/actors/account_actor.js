var account = require('./account')

module.exports = function () {
  return {
    // enable the ability to provide function to produce/fetch initial state
    // split "config" concerns out of actor property
    actor: { // metadata and configuration not persisted
      namespace: 'ledger',
      type: 'account',
      eventThreshold: 5,
      identifiedBy: 'number'
    },
    state: { // initial state for the model
      number: '',
      holder: '',
      balance: 0,
      open: false,
      transactions: []
    },
    commands: {
      open: account.open,
      close: account.close,
      deposit: [
        { when: account.isOpen, then: account.deposit },
        _.noop
      ],
      withdraw: [
        { when: account.canWithdraw, then: account.withdraw },
        _.noop
      ]
    },
    events: {
      opened: account.opened,
      closed: account.closed,
      deposited: account.deposited,
      withdrawn: account.withdrawn
    }
  }
}
