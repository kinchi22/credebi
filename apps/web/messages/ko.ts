import { type Catalogue } from './en';

const productName = 'Credebi';
const accountNotSaved =
  '저장하지 못했습니다. 이름은 1~40자, 설명은 200자 이내여야 하며, 사용 종료일은 사용 시작일보다 앞설 수 없습니다.';
const groupNotSaved =
  '저장하지 못했습니다. 이름은 1~40자, 설명은 200자 이내여야 합니다.';

const notMoved =
  '이동하지 못했습니다. 계정은 같은 계정 유형 안에서만 옮길 수 있고, 그룹은 다른 그룹 안으로 옮길 수 없습니다.';
const unmoved = '이동에 실패했습니다. 잠시 후 다시 시도해 주세요.';
const signedOutOfChart = '로그아웃되었습니다. 계정을 변경하려면 다시 로그인하세요.';

const NODE = { account: '계정', group: '그룹' } as const;

function nodeNotFound(node: keyof typeof NODE) {
  return `이 ${NODE[node]}은 존재하지 않습니다. 페이지를 새로 고쳐 주세요.`;
}

function chartRefusals(
  node: keyof typeof NODE,
  notSaved: string,
  nameTaken: string,
  inUse: string = notSaved,
) {
  const unsaved = `${NODE[node]}의 저장에 실패했습니다. 다시 시도해 주세요.`;
  return {
    INVALID_INPUT: notSaved,
    NAME_TAKEN: nameTaken,
    IN_USE: inUse,
    TITLE_TOO_LONG: notSaved,
    MEMO_TOO_LONG: notSaved,
    NOT_FOUND: nodeNotFound(node),
    CONFLICT: unsaved,
    DEPENDENCY_UNAVAILABLE: unsaved,
    UNBALANCED: notSaved,
    UNAUTHENTICATED: signedOutOfChart,
  } as const;
}

function deleteRefusals(node: keyof typeof NODE, inUse: string) {
  const reload = `${NODE[node]}의 삭제에 실패했습니다. 페이지를 새로 고친 뒤 다시 시도해 주세요.`;
  const undeleted = `${NODE[node]}의 삭제에 실패했습니다. 다시 시도해 주세요.`;
  return {
    INVALID_INPUT: reload,
    NAME_TAKEN: reload,
    UNBALANCED: reload,
    IN_USE: inUse,
    TITLE_TOO_LONG: reload,
    MEMO_TOO_LONG: reload,
    NOT_FOUND: nodeNotFound(node),
    CONFLICT: undeleted,
    DEPENDENCY_UNAVAILABLE: undeleted,
    UNAUTHENTICATED: signedOutOfChart,
  } as const;
}

const entryNotDeleted = '이 거래를 삭제할 수 없습니다. 페이지를 새로 고친 뒤 다시 시도해 주세요.';
const entryChangedElsewhere =
  '이 거래는 다른 곳에서 변경되었습니다. 페이지를 새로 고쳐 주세요.';
const entryGone = '이 거래는 존재하지 않습니다. 페이지를 새로 고쳐 주세요.';
const unbalanced = '차변과 대변의 합계가 같아야 합니다. 각 변의 금액을 확인하세요.';
const entryNotSavedCheck =
  '거래를 저장하지 못했습니다. 날짜, 제목, 메모, 계정, 금액을 확인하세요.';

export const ko = {
  app: {
    name: productName,
    titleTemplate: `%s · ${productName}`,
    description: '복식부기 장부.',
  },
  language: {
    label: '언어',
    names: {
      en: 'English',
      ko: '한국어',
      ja: '日本語',
    },
  },
  notFoundPage: {
    title: '페이지를 찾을 수 없습니다',
  },
  healthPanel: {
    title: '파이프라인 상태',
    reachable: '연결됨',
    unreachable: '연결 안 됨',
    checkedAt: '{instant}에 확인',
  },
  refreshButton: {
    idle: '다시 확인',
    pending: '확인 중...',
  },
  home: {
    entriesLink: '거래 입력',
  },
  signInPage: {
    title: '로그인',
    google: 'Google로 로그인',
    failed: '로그인하지 못했습니다. 다시 시도해 주세요.',
  },
  testSignIn: {
    title: '테스트 로그인',
    identifier: '식별자',
    accountsStartOn: '계정 시작일',
    submit: '로그인',
  },
  sidebar: {
    ariaLabel: '사이드바',
    menu: '메뉴',
    entries: '거래 입력',
    entrySearch: '거래 검색',
    incomeStatement: '손익계산서',
    assetsAndLiabilities: '자산·부채',
    assetsAndLiabilitiesTrend: '자산·부채 추이',
    settings: '설정',
    signOut: '로그아웃',
  },
  entriesPage: {
    title: '거래 입력',
  },
  settingsPage: {
    title: '설정',
    entryFormMode: '거래 입력 방식',
    entryFormModes: {
      'two-line': '2행 방식',
      'multi-line': '다행 방식',
    },
    entryFormModeDescriptions: {
      'two-line': '차변 계정과 대변 계정 하나씩, 하나의 금액을 공유합니다.',
      'multi-line': '차변과 대변이 여러 행을 가지며 각 행에 금액을 설정합니다.',
    },
    notSaved: '저장에 실패했습니다. 다시 시도해 주세요.',
    languageNotSaved: '저장에 실패했습니다. 다시 시도해 주세요.',
  },
  accountsSection: {
    title: '계정',
    showEnded: '종료된 계정 표시',
    addAccount: '계정 추가',
    addAccountText: '+ 계정',
    addGroup: '그룹 추가',
    addGroupText: '+ 그룹',
    edit: '수정',
    delete: '삭제',
    move: '{name} 이동',
    startsOn: '<day>{date}</day> 시작',
    moveRefusals: {
      INVALID_INPUT: notMoved,
      NAME_TAKEN: notMoved,
      IN_USE: notMoved,
      TITLE_TOO_LONG: notMoved,
      MEMO_TOO_LONG: notMoved,
      UNBALANCED: notMoved,
      NOT_FOUND: '계정이나 그룹이 더 이상 없어 이동을 되돌렸습니다. 페이지를 새로 고쳐 주세요.',
      CONFLICT: unmoved,
      DEPENDENCY_UNAVAILABLE: unmoved,
      UNAUTHENTICATED: signedOutOfChart,
    },
    drag: {
      instructions:
        '포인터로 손잡이를 끌어 계정이나 그룹을 옮깁니다. 계정 수정의 그룹 항목으로도 계정을 옮길 수 있습니다.',
      pickedUp: '{name}을(를) 집었습니다',
      wouldGo: '{name}이(가) {place} 놓입니다',
      went: '{name}을(를) {place} 옮겼습니다',
      into: '{group} 안에',
      intoBefore: '{group} 안의 {sibling} 앞에',
      before: '{sibling} 앞에',
      lastIn: '{accountType}의 맨 끝에',
      stays: '{name}은(는) 제자리에 있게 됩니다',
      overNothing: '{name}을(를) 놓을 수 있는 곳이 아닙니다',
      putBack: '{name}을(를) 원래 자리로 되돌렸습니다',
    },
  },
  accountDialog: {
    addTitle: '계정 추가',
    editTitle: '계정 수정',
    addGroupTitle: '그룹 추가',
    editGroupTitle: '그룹 수정',
    name: '이름',
    description: '설명',
    group: '그룹',
    noGroup: '그룹 없음',
    activeFrom: '사용 시작일',
    activeUntil: '사용 종료일',
    save: '저장',
    pending: '저장 중...',
    close: '닫기',
    addAnother: '계속 추가',
    added: '{name}을(를) 추가했습니다.',
    refusals: chartRefusals(
      'account',
      accountNotSaved,
      '저장에 실패했습니다. 같은 이름의 계정이 이미 있으니 다른 이름을 정하세요.',
      '저장에 실패했습니다. 이 사용 기간 밖의 날짜에 이 계정을 쓴 거래가 있습니다. 그 날짜가 사용 시작일과 사용 종료일 사이에 들도록 하세요.',
    ),
    groupRefusals: chartRefusals(
      'group',
      groupNotSaved,
      '저장에 실패했습니다. 이 계정 유형에 같은 이름의 그룹이 이미 있으니 다른 이름을 정하세요.',
    ),
  },
  deleteAccountDialog: {
    title: '계정 삭제',
    groupTitle: '그룹 삭제',
    confirm: '삭제',
    pending: '삭제 중...',
    cancel: '취소',
    refusals: deleteRefusals(
      'account',
      '등록된 거래에서 이 계정을 사용하고 있어 삭제하지 못했습니다. 더 사용하지 않으려면 대신 사용 종료일을 정하세요.',
    ),
    groupRefusals: deleteRefusals(
      'group',
      '그룹에 아직 계정이 있어 삭제하지 못했습니다. 계정을 먼저 그룹 밖으로 옮기거나 삭제하세요.',
    ),
  },
  entrySearchPage: {
    heading: '거래 검색',
  },
  dayRange: {
    from: '시작일',
    to: '종료일',
  },
  monthRange: {
    from: '시작 월',
    to: '종료 월',
  },
  entrySearch: {
    title: '거래 검색',
    account: '계정',
    anyAccount: '모든 계정',
    accountOption: '{name}, {type}',
    noAccountMatches: '일치하는 계정이 없습니다',
    clearAccount: '계정 지우기',
    accountNotChosen: '목록에서 계정을 선택하거나, 모든 계정을 검색하려면 입력란을 비우세요.',
    entryTitle: '제목',
    memo: '메모',
    submit: '검색',
    results: '결과',
    searching: '지난 한 달을 검색하는 중...',
    unavailable: '지금은 검색할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    nothingMatched: '조건에 맞는 거래가 없습니다.',
    refused:
      '날짜 범위의 시작일은 종료일보다 늦을 수 없습니다. 계정이 목록에 있는 것인지, 제목과 메모가 허용된 길이를 넘지 않는지 확인하세요.',
  },
  incomeStatementPage: {
    title: '손익계산서',
  },
  assetsAndLiabilitiesPage: {
    title: '자산·부채',
  },
  assetsAndLiabilities: {
    reportDate: '기준일',
    date: '날짜',
    show: '조회',
    assets: '자산',
    liabilities: '부채',
    totals: '합계',
    totalAssets: '자산 합계',
    totalLiabilities: '부채 합계',
    netWorth: '순자산',
    refused: '자산·부채를 표시하지 않았습니다. 날짜를 확인하세요. 달력상의 하루여야 합니다.',
    unavailable: '지금은 자산·부채를 불러올 수 없습니다. 조회를 눌러 다시 시도해 주세요.',
    loading: '오늘의 잔액을 불러오는 중...',
  },
  assetsAndLiabilitiesTrendPage: {
    title: '자산·부채 추이',
  },
  assetsAndLiabilitiesTrend: {
    range: '추이 기간',
    show: '조회',
    month: '월',
    nothingRecorded: '이 기간의 마지막 달까지 기록된 내용이 아직 없습니다.',
    refused:
      '자산·부채 추이를 표시하지 않았습니다. 기간을 확인하세요. 각 값은 달력상의 월이어야 하고, 시작 월은 종료 월보다 늦을 수 없으며, 기간은 최대 {most}개월입니다.',
    unavailable: '지금은 자산·부채 추이를 불러올 수 없습니다. 조회를 눌러 다시 시도해 주세요.',
  },
  incomeStatement: {
    period: '조회 기간',
    show: '조회',
    revenue: '수익',
    expenses: '비용',
    totals: '합계',
    totalRevenue: '수익 합계',
    totalExpense: '비용 합계',
    netIncome: '순이익',
    refused:
      '손익계산서를 표시하지 않았습니다. 날짜 범위를 확인하세요. 각 날짜는 달력상의 날짜여야 하며, 시작일은 종료일보다 늦을 수 없습니다.',
    unavailable: '지금은 손익계산서를 불러올 수 없습니다. 조회를 눌러 다시 시도해 주세요.',
    loading: '이번 달을 불러오는 중...',
  },
  datePresets: {
    title: '기간 프리셋',
    choosePeriod: '기간 선택',
    close: '닫기',
    categories: {
      year: '연도',
      quarter: '분기',
      month: '월',
      relative: '상대 기간',
    },
    quarter: '{quarter}분기',
    month: '{month}월',
    periodOfYear: '{year}년 {period}',
    relative: {
      last: '지난 {months}개월',
      next: '다음 {months}개월',
      around: '±{months}개월',
    },
  },
  entryForm: {
    title: '새 거래',
    date: '날짜',
    entryTitle: '제목',
    memo: '메모',
    chooseAccount: '계정을 선택해주세요',
    submit: '거래 추가',
    pending: '추가 중...',
    unbalanced,
    unavailable: '지금은 거래를 저장할 수 없습니다. 다시 시도해 주세요.',
    signedOut: '로그아웃되었습니다. 거래를 추가하려면 다시 로그인하세요.',
    titleTooLong: '거래를 추가하지 못했습니다. 제목은 40자 이내여야 합니다.',
    memoTooLong: '거래를 추가하지 못했습니다. 메모는 200자 이내여야 합니다.',
  },
  twoLineForm: {
    debitAccount: '차변 계정',
    creditAccount: '대변 계정',
    amount: '금액',
    invalid: '거래를 추가하지 못했습니다. 날짜, 제목, 메모, 두 계정, 금액을 확인하세요.',
  },
  multiLineForm: {
    debitAccounts: '차변 계정',
    creditAccounts: '대변 계정',
    amount: '금액',
    invalid: '거래를 추가하지 못했습니다. 날짜, 제목, 메모, 각 행을 확인하세요.',
    remove: '삭제',
    debitTotal: '차변 합계',
    creditTotal: '대변 합계',
    difference: '차액',
    tooLarge: '이 금액들의 합이 한 금액에 담을 수 있는 한도를 넘습니다.',
  },
  notActiveOnDay: {
    mark: '이 날짜에 활성화되지 않은 계정',
    multiLine: {
      notAdded:
        '거래를 추가하지 못했습니다. {side} {account}은(는) 이 날짜에 활성화되지 않은 계정입니다. 그 행을 지우거나, 그 계정이 활성화되어 있는 날짜를 고르세요.',
      notSaved:
        '거래를 저장하지 못했습니다. {side} {account}은(는) 이 날짜에 활성화되지 않은 계정입니다. 그 행을 지우거나, 그 계정이 활성화되어 있는 날짜를 고르세요.',
      explanation:
        '{account}은(는) 사용 기간 안에서만 쓸 수 있습니다. 날짜를 바꾸거나, 행을 지우거나, <settings>설정</settings>에서 기간을 바꾸세요.',
    },
    twoLine: {
      notAdded:
        '거래를 추가하지 못했습니다. {account}은(는) 이 날짜에 활성화되지 않은 계정입니다. 다른 계정을 고르거나, 그 계정이 활성화되어 있는 날짜를 고르세요.',
      notSaved:
        '거래를 저장하지 못했습니다. {account}은(는) 이 날짜에 활성화되지 않은 계정입니다. 다른 계정을 고르거나, 그 계정이 활성화되어 있는 날짜를 고르세요.',
      explanation:
        '{account}은(는) 사용 기간 안에서만 쓸 수 있습니다. 날짜를 바꾸거나, 다른 계정을 고르거나, <settings>설정</settings>에서 기간을 바꾸세요.',
    },
  },
  needsMultiLineMode: {
    mark: '다행 방식 필요',
    explanation:
      '제목이 {title}인 최근 거래는 한 변에 행이 둘 이상이라 아무것도 채우지 못했습니다. 차변 계정과 대변 계정을 골라 직접 작성하거나, <settings>설정</settings>에서 거래 입력 방식을 바꿔 모든 행을 채우세요.',
  },
  helpTip: {
    about: '{subject} 설명',
  },
  accountSheet: {
    title: '계정 선택',
    done: '완료',
    close: '닫기',
    find: '계정 검색',
    noMatch: '"{query}"에 맞는 계정이 없습니다.',
    suggested: '추천',
    increase: '증가',
    decrease: '감소',
    typeDirection: '{type}, {direction}',
    noActiveAccount: '이 날짜에 사용하는 계정이 없습니다.',
    settingsLink: '설정에서 계정의 사용 기간 바꾸기',
    add: {
      debit: '차변 계정 추가',
      credit: '대변 계정 추가',
    },
    choose: {
      debit: '차변 계정 선택',
      credit: '대변 계정 선택',
    },
  },
  entryList: {
    title: '거래 내역',
    empty: '아직 거래가 없습니다.',
    total: '합계',
  },
  editEntry: {
    open: '수정',
    title: '거래 수정',
    close: '닫기',
    save: '저장',
    pending: '저장 중...',
    refusals: {
      INVALID_INPUT:
        '거래를 저장하지 못했습니다. 날짜, 제목, 메모, 계정(각각 거래 날짜에 활성화된 계정이어야 합니다), 금액을 확인하세요.',
      UNBALANCED: unbalanced,
      NOT_FOUND: entryGone,
      CONFLICT: entryChangedElsewhere,
      DEPENDENCY_UNAVAILABLE: '지금은 거래를 저장할 수 없습니다. 다시 시도해 주세요.',
      UNAUTHENTICATED: '로그아웃되었습니다. 거래를 수정하려면 다시 로그인하세요.',
      NAME_TAKEN: entryNotSavedCheck,
      IN_USE: entryNotSavedCheck,
      TITLE_TOO_LONG: '거래를 저장하지 못했습니다. 제목은 40자 이내여야 합니다.',
      MEMO_TOO_LONG: '거래를 저장하지 못했습니다. 메모는 200자 이내여야 합니다.',
    },
  },
  discardChanges: {
    title: '변경 내용 버리기',
    entry: '이 거래의 변경 내용을 저장하지 않았으며, 버리면 사라집니다.',
    account: '이 계정의 변경 내용을 저장하지 않았으며, 버리면 사라집니다.',
    group: '이 그룹의 변경 내용을 저장하지 않았으며, 버리면 사라집니다.',
    keep: '계속 수정',
    confirm: '버리기',
  },
  deleteEntry: {
    open: '삭제',
    title: '거래 삭제',
    confirm: '삭제',
    pending: '삭제 중...',
    cancel: '취소',
    refusals: {
      INVALID_INPUT: entryNotDeleted,
      NOT_FOUND: entryGone,
      CONFLICT: entryChangedElsewhere,
      DEPENDENCY_UNAVAILABLE: '지금은 거래를 삭제할 수 없습니다. 다시 시도해 주세요.',
      UNBALANCED: entryNotDeleted,
      UNAUTHENTICATED: '로그아웃되었습니다. 거래를 삭제하려면 다시 로그인하세요.',
      NAME_TAKEN: entryNotDeleted,
      IN_USE: entryNotDeleted,
      TITLE_TOO_LONG: entryNotDeleted,
      MEMO_TOO_LONG: entryNotDeleted,
    },
  },
  startingChart: {
    cashAndDeposits: {
      name: '현금과 예금',
      description: '현금과 은행 예금을 모아 보는 그룹',
    },
    cash: {
      name: '현금',
      description: '지갑 등에 보관한 현금',
    },
    bankDeposits: {
      name: '은행 예금',
      description: '은행 계좌에 보관한 돈',
    },
    creditCardPayable: {
      name: '신용카드 미결제금',
      description: '신용카드로 사용하고 아직 갚지 않은 금액',
    },
    openingBalanceEquity: {
      name: '시작 잔액',
      description: '기록을 시작할 때 가진 자산과 부채의 차액',
    },
    salary: {
      name: '급여',
      description: '일한 대가로 받은 급여',
    },
    livingExpenses: {
      name: '생활비',
      description: '일상생활에 쓴 비용을 모아 보는 그룹',
    },
    food: {
      name: '식비',
      description: '식재료 구입과 외식에 쓴 돈',
    },
    transportation: {
      name: '교통비',
      description: '대중교통 등 이동에 쓴 돈',
    },
    otherLivingExpenses: {
      name: '기타 생활비',
      description: '별도 계정과목으로 나누지 않은 생활 지출',
    },
  },
  accountTypes: {
    asset: '자산',
    liability: '부채',
    equity: '자본',
    revenue: '수익',
    expense: '비용',
  },
  entryLine: {
    name: '{side} {account}',
  },
  sides: {
    debit: '차변',
    credit: '대변',
  },
} as const satisfies Catalogue;
