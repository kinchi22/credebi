import { type Catalogue } from './en';

const productName = 'Credebi';
const accountNotSaved =
  '勘定科目は保存されませんでした。名前は1〜40文字、説明は200文字以内で、使用終了日を使用開始日より前にはできません。';
const groupNotSaved =
  'グループは保存されませんでした。名前は1〜40文字、説明は200文字以内です。';

const notMoved =
  '移動を元に戻しました。勘定科目は同じ勘定区分の中でのみ移動でき、グループを別のグループの中に入れることはできません。';
const unmoved = '今は移動を保存できなかったため、元に戻しました。もう一度お試しください。';
const signedOutOfChart = 'ログアウトしています。勘定科目を変更するには、もう一度ログインしてください。';

const NODE = { account: '勘定科目', group: 'グループ' } as const;

function chartRefusals(
  node: keyof typeof NODE,
  notSaved: string,
  nameTaken: string,
  inUse: string = notSaved,
) {
  const unsaved = `今は${NODE[node]}を保存できなかったため、何も変更されていません。もう一度お試しください。`;
  return {
    INVALID_INPUT: notSaved,
    NAME_TAKEN: nameTaken,
    IN_USE: inUse,
    TITLE_TOO_LONG: notSaved,
    MEMO_TOO_LONG: notSaved,
    NOT_FOUND: `この${NODE[node]}はもうありません。ページを再読み込みしてください。`,
    CONFLICT: unsaved,
    DEPENDENCY_UNAVAILABLE: unsaved,
    UNBALANCED: notSaved,
    UNAUTHENTICATED: signedOutOfChart,
  } as const;
}

function deleteRefusals(node: keyof typeof NODE, inUse: string) {
  const reload = `この${NODE[node]}を削除できませんでした。ページを再読み込みして、もう一度お試しください。`;
  const undeleted = `今は${NODE[node]}を削除できなかったため、何も変更されていません。もう一度お試しください。`;
  return {
    INVALID_INPUT: reload,
    NAME_TAKEN: reload,
    UNBALANCED: reload,
    IN_USE: inUse,
    TITLE_TOO_LONG: reload,
    MEMO_TOO_LONG: reload,
    NOT_FOUND: `この${NODE[node]}はもうありません。ページを再読み込みしてください。`,
    CONFLICT: undeleted,
    DEPENDENCY_UNAVAILABLE: undeleted,
    UNAUTHENTICATED: signedOutOfChart,
  } as const;
}

const entryNotDeleted =
  'この仕訳を削除できませんでした。ページを再読み込みして、もう一度お試しください。';
const entryChangedElsewhere =
  'この仕訳は別の場所（別のタブかもしれません）で変更されました。ページを再読み込みしてください。';
const entryGone = 'この仕訳はもうありません。ページを再読み込みしてください。';
const unbalanced = '借方と貸方の合計を一致させてください。それぞれの金額を確認してください。';
const entryNotSavedCheck =
  '仕訳は保存されませんでした。日付、タイトル、メモ、勘定科目、金額を確認してください。';

export const ja = {
  app: {
    name: productName,
    titleTemplate: `%s · ${productName}`,
    description: '複式簿記の帳簿。',
  },
  language: {
    label: '言語',
    names: {
      en: 'English',
      ko: '한국어',
      ja: '日本語',
    },
  },
  notFoundPage: {
    title: 'ページが見つかりません',
  },
  healthPanel: {
    title: 'パイプラインの状態',
    reachable: '接続可能',
    unreachable: '接続不可',
    checkedAt: '{instant}に確認',
  },
  refreshButton: {
    idle: '再確認',
    pending: '確認中...',
  },
  home: {
    entriesLink: '仕訳',
  },
  signInPage: {
    title: 'ログイン',
    google: 'Googleでログイン',
    failed: 'ログインできませんでした。もう一度お試しください。',
  },
  testSignIn: {
    title: 'テストログイン',
    identifier: '識別子',
    accountsStartOn: '勘定科目の開始日',
    submit: 'ログイン',
  },
  sidebar: {
    ariaLabel: 'サイドバー',
    menu: 'メニュー',
    entries: '仕訳',
    entrySearch: '仕訳検索',
    settings: '設定',
    signOut: 'ログアウト',
  },
  entriesPage: {
    title: '仕訳',
  },
  settingsPage: {
    title: '設定',
    entryFormMode: '仕訳の入力方式',
    entryFormModes: {
      'two-line': '2行方式',
      'multi-line': '複数行方式',
    },
    entryFormModeDescriptions: {
      'two-line': '借方の勘定科目が1つ、貸方の勘定科目が1つ、金額が1つ。',
      'multi-line': '仕訳の行が2つ以上、各行が借方か貸方。',
    },
    notSaved: '選択は保存されなかったため、仕訳の入力方式は変わっていません。もう一度お試しください。',
    languageNotSaved: '選択は保存されなかったため、言語は変わっていません。もう一度お試しください。',
  },
  accountsSection: {
    title: '勘定科目',
    showEnded: '終了した勘定科目を表示',
    addAccount: '勘定科目を追加',
    addAccountText: '+ 勘定科目',
    addGroup: 'グループを追加',
    addGroupText: '+ グループ',
    edit: '編集',
    delete: '削除',
    move: '{name}を移動',
    startsOn: '<day>{date}</day>開始',
    moveRefusals: {
      INVALID_INPUT: notMoved,
      NAME_TAKEN: notMoved,
      IN_USE: notMoved,
      TITLE_TOO_LONG: notMoved,
      MEMO_TOO_LONG: notMoved,
      UNBALANCED: notMoved,
      NOT_FOUND:
        '勘定科目またはグループがもうないため、移動を元に戻しました。ページを再読み込みしてください。',
      CONFLICT: unmoved,
      DEPENDENCY_UNAVAILABLE: unmoved,
      UNAUTHENTICATED: signedOutOfChart,
    },
    drag: {
      instructions:
        'ポインターでつまみをドラッグすると、勘定科目やグループを移動できます。勘定科目の編集のグループ欄でも勘定科目を移動できます。',
      pickedUp: '{name}をつかみました',
      wouldGo: '{name}は{place}入ります',
      went: '{name}を{place}移動しました',
      into: '{group}の中に',
      intoBefore: '{group}の中の{sibling}の前に',
      before: '{sibling}の前に',
      lastIn: '{accountType}の最後に',
      stays: '{name}は元の位置のままです',
      overNothing: '{name}はドロップできない場所の上にあります',
      putBack: '{name}を元の位置に戻しました',
    },
  },
  accountDialog: {
    addTitle: '勘定科目を追加',
    editTitle: '勘定科目を編集',
    addGroupTitle: 'グループを追加',
    editGroupTitle: 'グループを編集',
    name: '名前',
    description: '説明',
    group: 'グループ',
    noGroup: 'グループなし',
    activeFrom: '使用開始日',
    activeUntil: '使用終了日',
    save: '保存',
    pending: '保存中...',
    close: '閉じる',
    addAnother: '続けて追加',
    added: '{name}を追加しました。',
    refusals: chartRefusals(
      'account',
      accountNotSaved,
      '勘定科目は保存されませんでした。同じ名前の勘定科目がすでにあります。別の名前にしてください。',
      '勘定科目は保存されませんでした。この使用期間の外の日付に、この勘定科目を使った仕訳があります。その日付が使用開始日と使用終了日の間に入るようにしてください。',
    ),
    groupRefusals: chartRefusals(
      'group',
      groupNotSaved,
      'グループは保存されませんでした。この勘定区分に同じ名前のグループがすでにあります。別の名前にしてください。',
    ),
  },
  deleteAccountDialog: {
    title: '勘定科目を削除',
    groupTitle: 'グループを削除',
    confirm: '削除',
    pending: '削除中...',
    cancel: 'キャンセル',
    refusals: deleteRefusals(
      'account',
      '表示中の仕訳がこの勘定科目を使っているため、削除しませんでした。使うのをやめるには、代わりに使用終了日を設定してください。',
    ),
    groupRefusals: deleteRefusals(
      'group',
      'グループにまだ勘定科目があるため、削除しませんでした。先に勘定科目をグループの外に移動するか、削除してください。',
    ),
  },
  entrySearchPage: {
    heading: '仕訳検索',
  },
  entrySearch: {
    title: '仕訳を検索',
    from: '開始',
    to: '終了',
    account: '勘定科目',
    anyAccount: 'すべての勘定科目',
    entryTitle: 'タイトル',
    memo: 'メモ',
    submit: '検索',
    results: '結果',
    searching: '過去1か月を検索中...',
    unavailable: '今は検索できませんでした。検索を押して、もう一度お試しください。',
    nothingMatched: '条件に合う仕訳はありません。',
    refused:
      '検索しませんでした。日付の範囲（各日付は暦の1日で、開始を終了より後にはできません）、勘定科目が一覧にあるものか、タイトルとメモが上限の長さを超えていないかを確認してください。',
  },
  datePresets: {
    title: '期間のプリセット',
    choosePeriod: '期間を選択',
    close: '閉じる',
    categories: {
      year: '年',
      quarter: '四半期',
      month: '月',
      relative: '相対期間',
    },
    quarter: '第{quarter}四半期',
    month: '{month}月',
    periodOfYear: '{year}年{period}',
    relative: {
      last: '過去{months}か月',
      next: '今後{months}か月',
      around: '±{months}か月',
    },
  },
  entryForm: {
    title: '新しい仕訳',
    date: '日付',
    entryTitle: 'タイトル',
    memo: 'メモ',
    chooseAccount: '勘定科目を選択',
    submit: '仕訳を追加',
    pending: '追加中...',
    unbalanced,
    unavailable: '今は仕訳を保存できませんでした。もう一度お試しください。',
    signedOut: 'ログアウトしています。仕訳を追加するには、もう一度ログインしてください。',
    titleTooLong: '仕訳は追加されませんでした。タイトルは40文字以内です。',
    memoTooLong: '仕訳は追加されませんでした。メモは200文字以内です。',
  },
  twoLineForm: {
    debitAccount: '借方の勘定科目',
    creditAccount: '貸方の勘定科目',
    amount: '金額',
    invalid: '仕訳は追加されませんでした。日付、タイトル、メモ、両方の勘定科目、金額を確認してください。',
  },
  multiLineForm: {
    debitAccounts: '借方の勘定科目',
    creditAccounts: '貸方の勘定科目',
    amount: '金額',
    invalid: '仕訳は追加されませんでした。日付、タイトル、メモ、各行を確認してください。',
    remove: '削除',
    debitTotal: '借方合計',
    creditTotal: '貸方合計',
    difference: '差額',
    tooLarge: 'これらの金額の合計が、1つの金額で扱える上限を超えています。',
  },
  notActiveOnDay: {
    mark: 'この日は使用期間外',
    multiLine: {
      notAdded:
        '仕訳は追加されませんでした。{side}の{account}はこの日には使用期間外です。その行を削除するか、その勘定科目を使用できる日を選んでください。',
      notSaved:
        '仕訳は保存されませんでした。{side}の{account}はこの日には使用期間外です。その行を削除するか、その勘定科目を使用できる日を選んでください。',
      explanation:
        '{account}は使用期間内でのみ使えます。日付を変えるか、行を削除するか、<settings>設定</settings>で期間を変更してください。',
    },
    twoLine: {
      notAdded:
        '仕訳は追加されませんでした。{account}はこの日には使用期間外です。別の勘定科目を選ぶか、その勘定科目を使用できる日を選んでください。',
      notSaved:
        '仕訳は保存されませんでした。{account}はこの日には使用期間外です。別の勘定科目を選ぶか、その勘定科目を使用できる日を選んでください。',
      explanation:
        '{account}は使用期間内でのみ使えます。日付を変えるか、別の勘定科目を選ぶか、<settings>設定</settings>で期間を変更してください。',
    },
  },
  needsMultiLineMode: {
    mark: '複数行方式が必要',
    explanation:
      'タイトルが{title}の直近の仕訳は、借方か貸方に2行以上あるため、何も入力しませんでした。借方と貸方の勘定科目を選んでこの仕訳を自分で書くか、<settings>設定</settings>で仕訳の入力方式を変えてすべての行を入力してください。',
  },
  helpTip: {
    about: '{subject}について',
  },
  accountSheet: {
    title: '勘定科目を選択',
    done: '完了',
    close: '閉じる',
    find: '勘定科目を探す',
    noMatch: '「{query}」に合う勘定科目はありません。',
    suggested: 'おすすめ',
    noActiveAccount: 'この日に使用できる勘定科目はありません。',
    settingsLink: '設定で勘定科目の使用期間を変更',
    add: {
      debit: '借方の勘定科目を追加',
      credit: '貸方の勘定科目を追加',
    },
    choose: {
      debit: '借方の勘定科目を選択',
      credit: '貸方の勘定科目を選択',
    },
  },
  entryList: {
    title: '仕訳',
    empty: '仕訳はまだありません。',
    total: '合計',
  },
  editEntry: {
    open: '編集',
    title: '仕訳を編集',
    close: '閉じる',
    save: '保存',
    pending: '保存中...',
    refusals: {
      INVALID_INPUT:
        '仕訳は保存されませんでした。日付、タイトル、メモ、勘定科目（それぞれ仕訳の日に使用期間内であること）、金額を確認してください。',
      UNBALANCED: unbalanced,
      NOT_FOUND: entryGone,
      CONFLICT: entryChangedElsewhere,
      DEPENDENCY_UNAVAILABLE: '今は仕訳を保存できませんでした。もう一度お試しください。',
      UNAUTHENTICATED: 'ログアウトしています。仕訳を編集するには、もう一度ログインしてください。',
      NAME_TAKEN: entryNotSavedCheck,
      IN_USE: entryNotSavedCheck,
      TITLE_TOO_LONG: '仕訳は保存されませんでした。タイトルは40文字以内です。',
      MEMO_TOO_LONG: '仕訳は保存されませんでした。メモは200文字以内です。',
    },
  },
  discardChanges: {
    title: '変更を破棄',
    entry: 'この仕訳への変更は保存されておらず、失われます。',
    account: 'この勘定科目への変更は保存されておらず、失われます。',
    group: 'このグループへの変更は保存されておらず、失われます。',
    keep: '編集を続ける',
    confirm: '破棄',
  },
  deleteEntry: {
    open: '削除',
    title: '仕訳を削除',
    confirm: '削除',
    pending: '削除中...',
    cancel: 'キャンセル',
    refusals: {
      INVALID_INPUT: entryNotDeleted,
      NOT_FOUND: entryGone,
      CONFLICT: entryChangedElsewhere,
      DEPENDENCY_UNAVAILABLE: '今は仕訳を削除できませんでした。もう一度お試しください。',
      UNBALANCED: entryNotDeleted,
      UNAUTHENTICATED: 'ログアウトしています。仕訳を削除するには、もう一度ログインしてください。',
      NAME_TAKEN: entryNotDeleted,
      IN_USE: entryNotDeleted,
      TITLE_TOO_LONG: entryNotDeleted,
      MEMO_TOO_LONG: entryNotDeleted,
    },
  },
  startingAccounts: {
    asset: '現金',
    liability: '買掛金',
    equity: '資本金',
    revenue: '売上',
    expense: '費用',
  },
  accountTypes: {
    asset: '資産',
    liability: '負債',
    equity: '純資産',
    revenue: '収益',
    expense: '費用',
  },
  entryLine: {
    name: '{side}の{account}',
  },
  sides: {
    debit: '借方',
    credit: '貸方',
  },
} as const satisfies Catalogue;
