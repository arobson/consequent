import account from './account.js'

export default function () {
  return {
    actor: {
      namespace: 'ledger',
      type: 'account',
      eventThreshold: 5,
      identifiedBy: 'number'
    },
    state: {
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
        () => {}
      ],
      withdraw: [
        { when: account.canWithdraw, then: account.withdraw },
        () => {}
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
