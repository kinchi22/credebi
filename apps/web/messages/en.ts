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
    TITLE_TOO_LONG: notSaved,
    MEMO_TOO_LONG: notSaved,
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
    TITLE_TOO_LONG: reload,
    MEMO_TOO_LONG: reload,
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
  language: {
    label: 'Language',
    names: {
      en: 'English',
      ko: '\uD55C\uAD6D\uC5B4',
      ja: '\u65E5\u672C\u8A9E',
    },
  },
  notFoundPage: {
    title: 'Page not found',
  },
  healthPanel: {
    title: 'Pipeline health',
    reachable: 'reachable',
    unreachable: 'unreachable',
    checkedAt: 'checked at {instant}',
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
    incomeStatement: 'Income statement',
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
    notSaved: 'Your choice was not saved, so your Entry form mode is unchanged. Try again.',
    languageNotSaved: 'Your choice was not saved, so your Language is unchanged. Try again.',
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
    move: 'Move {name}',
    startsOn: 'Starts <day>{date}</day>',
    moveRefusals: {
      INVALID_INPUT: notMoved,
      NAME_TAKEN: notMoved,
      IN_USE: notMoved,
      TITLE_TOO_LONG: notMoved,
      MEMO_TOO_LONG: notMoved,
      UNBALANCED: notMoved,
      NOT_FOUND: 'That move was put back, because the account or group is no longer here. Reload the page.',
      CONFLICT: unmoved,
      DEPENDENCY_UNAVAILABLE: unmoved,
      UNAUTHENTICATED: 'You are signed out. Sign in again to change your accounts.',
    },
    drag: {
      instructions:
        'Drag a grip with a pointer to move its account or group. The Group field of Edit account also moves an account.',
      pickedUp: 'Picked up {name}',
      wouldGo: '{name} would go {place}',
      went: '{name} was moved {place}',
      into: 'into {group}',
      intoBefore: 'into {group}, before {sibling}',
      before: 'before {sibling}',
      lastIn: 'last in {accountType}',
      stays: '{name} would stay where it is',
      overNothing: '{name} is over no place it can be dropped',
      putBack: '{name} was put back where it was',
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
    addAnother: 'Add another',
    added: '{name} was added.',
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
      'The account was not deleted, because a shown entry names it. To stop using it, give it an end day in Active until instead.',
    ),
    groupRefusals: deleteRefusals(
      'group',
      'The group was not deleted, because it still holds accounts. Move them out of it or delete them first.',
    ),
  },
  entrySearchPage: {
    heading: 'Entry search',
  },
  dayRange: {
    from: 'From',
    to: 'To',
  },
  entrySearch: {
    title: 'Search entries',
    account: 'Account',
    anyAccount: 'Any account',
    accountOption: '{name}, {type}',
    noAccountMatches: 'No account matches',
    clearAccount: 'Clear account',
    accountNotChosen: 'Choose an account from the list, or clear the field to search every account.',
    entryTitle: 'Title',
    memo: 'Memo',
    submit: 'Search',
    results: 'Results',
    searching: 'Searching the last month...',
    unavailable: 'The search could not be run just now. Press Search to try again.',
    nothingMatched: 'Nothing matched what you asked for.',
    refused:
      'That search was not run. Check the day range -- each day is a calendar day, and From cannot be later than To -- that the account is one of those listed, and that the Title and the memo are no longer than a Title and a memo can be.',
  },
  incomeStatementPage: {
    title: 'Income statement',
  },
  incomeStatement: {
    period: 'Statement period',
    show: 'Show',
    revenue: 'Revenue',
    expenses: 'Expenses',
    totals: 'Totals',
    totalRevenue: 'Total revenue',
    totalExpense: 'Total expense',
    difference: 'Difference',
    refused:
      'That statement was not shown. Check the day range: each day is a calendar day, and From cannot be later than To.',
    unavailable: 'The statement could not be loaded just now. Press Show to try again.',
    loading: 'Loading this month...',
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
    quarter: 'Q{quarter}',
    month:
      '{month, plural, =1 {Jan} =2 {Feb} =3 {Mar} =4 {Apr} =5 {May} =6 {Jun} =7 {Jul} =8 {Aug} =9 {Sep} =10 {Oct} =11 {Nov} =12 {Dec} other {#}}',
    periodOfYear: '{period} {year}',
    relative: {
      last: 'Last {months, plural, one {# month} other {# months}}',
      next: 'Next {months, plural, one {# month} other {# months}}',
      around: '\u00B1{months, plural, one {# month} other {# months}}',
    },
  },
  entryForm: {
    title: 'New entry',
    date: 'Date',
    entryTitle: 'Title',
    memo: 'Memo',
    chooseAccount: 'Choose an account',
    submit: 'Add entry',
    pending: 'Adding...',
    unbalanced: 'Debits and credits must balance. Check the amount on each side.',
    unavailable: 'The entry could not be saved just now. Try again.',
    signedOut: 'You are signed out. Sign in again to add an entry.',
    titleTooLong: 'The entry was not added. A Title can be at most 40 characters.',
    memoTooLong: 'The entry was not added. A memo can be at most 200 characters.',
  },
  twoLineForm: {
    debitAccount: 'Debit account',
    creditAccount: 'Credit account',
    amount: 'Amount',
    invalid: 'The entry was not added. Check the date, the Title, the memo, both accounts and the amount.',
  },
  multiLineForm: {
    debitAccounts: 'Debit accounts',
    creditAccounts: 'Credit accounts',
    amount: 'Amount',
    invalid: 'The entry was not added. Check the date, the Title, the memo and each line.',
    remove: 'Remove',
    debitTotal: 'Debit total',
    creditTotal: 'Credit total',
    difference: 'Difference',
    tooLarge: 'These amounts add up to more than an amount can hold.',
  },
  notActiveOnDay: {
    mark: 'Not active on this day',
    multiLine: {
      notAdded:
        'The entry was not added. {side} {account} is not active on this day. Remove that line, or choose a day on which its account is active.',
      notSaved:
        'The entry was not saved. {side} {account} is not active on this day. Remove that line, or choose a day on which its account is active.',
      explanation:
        '{account} can be used only within its active period. Change the day, remove the line, or change the period in <settings>Settings</settings>.',
    },
    twoLine: {
      notAdded:
        'The entry was not added. {account} is not active on this day. Choose another account, or choose a day on which it is active.',
      notSaved:
        'The entry was not saved. {account} is not active on this day. Choose another account, or choose a day on which it is active.',
      explanation:
        '{account} can be used only within its active period. Change the day, choose another account, or change the period in <settings>Settings</settings>.',
    },
  },
  needsMultiLineMode: {
    mark: 'Needs Multi-line mode',
    explanation:
      'The last Entry titled {title} has more than one line on a Side, so nothing was filled in. Choose a debit and a credit account to write this Entry yourself, or change the Entry form mode in <settings>Settings</settings> to fill every line.',
  },
  helpTip: {
    about: 'About {subject}',
  },
  accountSheet: {
    title: 'Choose accounts',
    done: 'Done',
    close: 'Close',
    find: 'Find an account',
    noMatch: 'No account matches "{query}".',
    suggested: 'Suggested',
    noActiveAccount: 'No account is active on this day.',
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
        'The entry was not saved. Check the date, the Title, the memo, the accounts -- each active on the entry\'s day -- and the amounts.',
      UNBALANCED: 'Debits and credits must balance. Check the amount on each side.',
      NOT_FOUND: 'This entry is no longer here. Reload the page.',
      CONFLICT: 'This entry was changed elsewhere, perhaps in another tab. Reload the page.',
      DEPENDENCY_UNAVAILABLE: 'The entry could not be saved just now. Try again.',
      UNAUTHENTICATED: 'You are signed out. Sign in again to edit an entry.',
      NAME_TAKEN: 'The entry was not saved. Check the date, the Title, the memo, the accounts and the amounts.',
      IN_USE: 'The entry was not saved. Check the date, the Title, the memo, the accounts and the amounts.',
      TITLE_TOO_LONG: 'The entry was not saved. A Title can be at most 40 characters.',
      MEMO_TOO_LONG: 'The entry was not saved. A memo can be at most 200 characters.',
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
      TITLE_TOO_LONG: 'This entry could not be deleted. Reload the page and try again.',
      MEMO_TOO_LONG: 'This entry could not be deleted. Reload the page and try again.',
    },
  },
  startingAccounts: {
    asset: 'Cash',
    liability: 'Accounts payable',
    equity: 'Capital',
    revenue: 'Sales',
    expense: 'Expenses',
  },
  accountTypes: {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    revenue: 'Revenue',
    expense: 'Expenses',
  },
  entryLine: {
    name: '{side} {account}',
  },
  sides: {
    debit: 'Debit',
    credit: 'Credit',
  },
} as const;

type CopyOf<Messages> = {
  readonly [Key in keyof Messages]: Messages[Key] extends string ? string : CopyOf<Messages[Key]>;
};

export type Catalogue = CopyOf<typeof en>;
