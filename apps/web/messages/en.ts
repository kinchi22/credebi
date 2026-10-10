const productName = 'Credebi';
const accountNotSaved =
  'The account was not saved. A name is 1 to 40 characters, a description at most 200, and Active until cannot be before Active from.';
const groupNotSaved =
  'The group was not saved. A name is 1 to 40 characters, and a description at most 200.';

const notMoved =
  'That move was put back. An account moves only within its account type, and a group never into another group.';
const unmoved = 'That move could not be saved just now, so it was put back. Try again.';

function chartRefusals(
  node: 'account' | 'group',
  notSaved: string,
  nameTaken: string,
  inUse: string = notSaved,
) {
  const unsaved = `The ${node} could not be saved just now, so nothing changed. Try again.`;
  return {
    INVALID_INPUT: notSaved,
    NAME_TAKEN: nameTaken,
    IN_USE: inUse,
    NOT_FOUND: `This ${node} is no longer here. Reload the page.`,
    CONFLICT: unsaved,
    DEPENDENCY_UNAVAILABLE: unsaved,
    UNBALANCED: notSaved,
    UNAUTHENTICATED: 'You are signed out. Sign in again to change your accounts.',
  } as const;
}

function deleteRefusals(node: 'account' | 'group', inUse: string) {
  const reload = `This ${node} could not be deleted. Reload the page and try again.`;
  const undeleted = `The ${node} could not be deleted just now, so nothing changed. Try again.`;
  return {
    INVALID_INPUT: reload,
    NAME_TAKEN: reload,
    UNBALANCED: reload,
    IN_USE: inUse,
    NOT_FOUND: `This ${node} is no longer here. Reload the page.`,
    CONFLICT: undeleted,
    DEPENDENCY_UNAVAILABLE: undeleted,
    UNAUTHENTICATED: 'You are signed out. Sign in again to change your accounts.',
  } as const;
}

export const en = {
  app: {
    name: productName,
    titleTemplate: `%s \u00B7 ${productName}`,
    description: 'Double-entry bookkeeping.',
  },
  notFoundPage: {
    title: 'Page not found',
  },
  healthPanel: {
    title: 'Pipeline health',
    reachable: 'reachable',
    unreachable: 'unreachable',
    checkedAt: 'checked at',
  },
  refreshButton: {
    idle: 'Re-check',
    pending: 'Checking...',
  },
  home: {
    entriesLink: 'Entries',
  },
  signInPage: {
    title: 'Sign in',
    google: 'Sign in with Google',
    failed: 'Signing in did not work. Try again.',
  },
  testSignIn: {
    title: 'Test sign-in',
    identifier: 'Identifier',
    accountsStartOn: 'Accounts start on',
    submit: 'Sign in',
  },
  sidebar: {
    ariaLabel: 'Sidebar',
    menu: 'Menu',
    entries: 'Entries',
    entrySearch: 'Entry search',
    settings: 'Settings',
    signOut: 'Sign out',
  },
  entriesPage: {
    title: 'Entries',
  },
  settingsPage: {
    title: 'Settings',
    entryFormMode: 'Entry form mode',
    entryFormModes: {
      'two-line': 'Two-line mode',
      'multi-line': 'Multi-line mode',
    },
    entryFormModeDescriptions: {
      'two-line': 'One debit Account, one credit Account, one amount.',
      'multi-line': 'Two or more Entry lines, each on its own Side.',
    },
    saved: 'Saved',
    notSaved: 'Your choice was not saved, so your Entry form mode is unchanged. Try again.',
  },
  accountsSection: {
    title: 'Accounts',
    showEnded: 'Show ended accounts',
    addAccount: 'Add account',
    addAccountText: '+ Account',
    addGroup: 'Add group',
    addGroupText: '+ Group',
    edit: 'Edit',
    delete: 'Delete',
    move: 'Move',
    startsOn: 'Starts',
    moveRefusals: {
      INVALID_INPUT: notMoved,
      NAME_TAKEN: notMoved,
      IN_USE: notMoved,
      UNBALANCED: notMoved,
      NOT_FOUND: 'That move was put back, because the account or group is no longer here. Reload the page.',
      CONFLICT: unmoved,
      DEPENDENCY_UNAVAILABLE: unmoved,
      UNAUTHENTICATED: 'You are signed out. Sign in again to change your accounts.',
    },
    drag: {
      instructions:
        'Drag a grip with a pointer to move its account or group. The Group field of Edit account also moves an account.',
      pickedUp: 'Picked up',
      wouldGo: 'would go',
      went: 'was moved',
      into: 'into',
      before: 'before',
      lastIn: 'last in',
      stays: 'would stay where it is',
      overNothing: 'is over no place it can be dropped',
      putBack: 'was put back where it was',
    },
  },
  accountDialog: {
    addTitle: 'Add account',
    editTitle: 'Edit account',
    addGroupTitle: 'Add group',
    editGroupTitle: 'Edit group',
    name: 'Name',
    description: 'Description',
    group: 'Group',
    noGroup: 'No group',
    activeFrom: 'Active from',
    activeUntil: 'Active until',
    save: 'Save',
    pending: 'Saving...',
    close: 'Close',
    refusals: chartRefusals(
      'account',
      accountNotSaved,
      'The account was not saved. Another of your accounts has this name; choose another.',
      'The account was not saved, because an entry names it on a day outside this Active period. Keep that day within Active from and Active until.',
    ),
    groupRefusals: chartRefusals(
      'group',
      groupNotSaved,
      'The group was not saved. Another group of this account type has this name; choose another.',
    ),
  },
  deleteAccountDialog: {
    title: 'Delete account',
    groupTitle: 'Delete group',
    confirm: 'Delete',
    pending: 'Deleting...',
    cancel: 'Cancel',
    refusals: deleteRefusals(
      'account',
      'The account was not deleted, because an entry names it -- an entry you deleted or edited included, since the books keep those too. To stop using it, give it an end day in Active until instead.',
    ),
    groupRefusals: deleteRefusals(
      'group',
      'The group was not deleted, because it still holds accounts. Move them out of it or delete them first.',
    ),
  },
  entrySearch: {
    title: 'Search entries',
    from: 'From',
    to: 'To',
    account: 'Account',
    anyAccount: 'Any account',
    memo: 'Memo',
    submit: 'Search',
    results: 'Results',
    searching: 'Searching the last month...',
    unavailable: 'The search could not be run just now. Press Search to try again.',
    nothingMatched: 'Nothing matched what you asked for.',
    refused:
      'That search was not run. Check the day range -- each day is a calendar day, and From cannot be later than To -- that the account is one of those listed, and that the memo is no longer than a memo can be.',
  },
  datePresets: {
    title: 'Date presets',
    choosePeriod: 'Choose a period',
    close: 'Close',
    categories: {
      year: 'Year',
      quarter: 'Quarter',
      month: 'Month',
      relative: 'Relative',
    },
    quarterPrefix: 'Q',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    relative: {
      last: 'Last ',
      next: 'Next ',
      around: '\u00B1',
    },
    monthUnit: {
      one: 'month',
      many: 'months',
    },
  },
  entryForm: {
    title: 'New entry',
    date: 'Date',
    memo: 'Memo',
    chooseAccount: 'Choose an account',
    submit: 'Add entry',
    pending: 'Adding...',
    unbalanced: 'Debits and credits must balance. Check the amount on each side.',
    unavailable: 'The entry could not be saved just now. Try again.',
    signedOut: 'You are signed out. Sign in again to add an entry.',
  },
  twoLineForm: {
    debitAccount: 'Debit account',
    creditAccount: 'Credit account',
    amount: 'Amount',
    invalid: 'The entry was not added. Check the date, the memo, both accounts and the amount.',
  },
  multiLineForm: {
    debitAccounts: 'Debit accounts',
    creditAccounts: 'Credit accounts',
    amount: 'Amount',
    invalid: 'The entry was not added. Check the date, the memo and each line.',
    remove: 'Remove',
    debitTotal: 'Debit total',
    creditTotal: 'Credit total',
    difference: 'Difference',
    tooLarge: 'These amounts add up to more than an amount can hold.',
    notActive: {
      mark: 'Not active on this day',
      notAdded: 'The entry was not added.',
      notSaved: 'The entry was not saved.',
      refusal:
        'is not active on this day. Remove that line, or choose a day on which its account is active.',
    },
  },
  accountSheet: {
    title: 'Choose accounts',
    done: 'Done',
    close: 'Close',
    find: 'Find an account',
    noMatch: 'No account matches',
    noActiveAccount: 'No account is active on this day.',
    outsideActivePeriod:
      'This entry cannot be saved on this day, because it is outside the Active period of',
    settingsLink: 'Change when your accounts are active in Settings',
    add: {
      debit: 'Add debit account',
      credit: 'Add credit account',
    },
    choose: {
      debit: 'Choose debit account',
      credit: 'Choose credit account',
    },
  },
  entryList: {
    title: 'Entries',
    empty: 'No entries yet.',
    total: 'Total',
  },
  editEntry: {
    open: 'Edit',
    title: 'Edit entry',
    close: 'Close',
    save: 'Save',
    pending: 'Saving...',
    refusals: {
      INVALID_INPUT:
        'The entry was not saved. Check the date, the memo, the accounts -- each active on the entry\'s day -- and the amounts.',
      UNBALANCED: 'Debits and credits must balance. Check the amount on each side.',
      NOT_FOUND: 'This entry is no longer here. Reload the page.',
      CONFLICT: 'This entry was changed elsewhere, perhaps in another tab. Reload the page.',
      DEPENDENCY_UNAVAILABLE: 'The entry could not be saved just now. Try again.',
      UNAUTHENTICATED: 'You are signed out. Sign in again to edit an entry.',
      NAME_TAKEN: 'The entry was not saved. Check the date, the memo, the accounts and the amounts.',
      IN_USE: 'The entry was not saved. Check the date, the memo, the accounts and the amounts.',
    },
  },
  discardChanges: {
    title: 'Discard changes',
    entry: 'Your changes to this entry have not been saved and will be lost.',
    account: 'Your changes to this account have not been saved and will be lost.',
    group: 'Your changes to this group have not been saved and will be lost.',
    keep: 'Keep editing',
    confirm: 'Discard',
  },
  deleteEntry: {
    open: 'Delete',
    title: 'Delete entry',
    confirm: 'Delete',
    pending: 'Deleting...',
    cancel: 'Cancel',
    refusals: {
      INVALID_INPUT: 'This entry could not be deleted. Reload the page and try again.',
      NOT_FOUND: 'This entry is no longer here. Reload the page.',
      CONFLICT: 'This entry was changed elsewhere, perhaps in another tab. Reload the page.',
      DEPENDENCY_UNAVAILABLE: 'The entry could not be deleted just now. Try again.',
      UNBALANCED: 'This entry could not be deleted. Reload the page and try again.',
      UNAUTHENTICATED: 'You are signed out. Sign in again to delete an entry.',
      NAME_TAKEN: 'This entry could not be deleted. Reload the page and try again.',
      IN_USE: 'This entry could not be deleted. Reload the page and try again.',
    },
  },
  accountTypes: {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    revenue: 'Revenue',
    expense: 'Expenses',
  },
  sides: {
    debit: 'Debit',
    credit: 'Credit',
  },
} as const;
