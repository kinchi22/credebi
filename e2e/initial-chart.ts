import { expect, type Locator, type Page } from '@playwright/test';
import { type AccountType, ACCOUNT_TYPES } from './entries';
import { type Language } from './language';

export type InitialAccount = {
  readonly kind: 'account';
  readonly name: string;
  readonly description: string;
};

export type InitialGroup = {
  readonly kind: 'group';
  readonly name: string;
  readonly description: string;
  readonly members: readonly InitialAccount[];
};

export type InitialNode = InitialAccount | InitialGroup;

export type InitialChart = Readonly<Record<AccountType, readonly InitialNode[]>>;

const account = (name: string, description: string): InitialAccount => ({ kind: 'account', name, description });

const group = (name: string, description: string, members: readonly InitialAccount[]): InitialGroup => ({
  kind: 'group',
  name,
  description,
  members,
});

export const INITIAL_CHART: Readonly<Record<Language, InitialChart>> = {
  en: {
    Assets: [
      group('Cash and deposits', 'A group for viewing cash and bank deposits together', [
        account('Cash', 'Cash kept in a wallet or elsewhere'),
        account('Bank deposits', 'Money held in bank accounts'),
      ]),
    ],
    Liabilities: [account('Credit card payable', 'Credit card spending that has not yet been repaid')],
    Equity: [
      account(
        'Opening balance equity',
        'The difference between assets and liabilities when recordkeeping begins',
      ),
    ],
    Revenue: [account('Salary', 'Salary received for work')],
    Expenses: [
      group('Living expenses', 'A group for viewing everyday living expenses together', [
        account('Food', 'Money spent on groceries and eating out'),
        account('Transportation', 'Money spent on getting around, including public transport'),
        account('Other living expenses', 'Living expenses not assigned to a separate account'),
      ]),
    ],
  },
  ko: {
    Assets: [
      group('\uD604\uAE08\uACFC \uC608\uAE08', '\uD604\uAE08\uACFC \uC740\uD589 \uC608\uAE08\uC744 \uBAA8\uC544 \uBCF4\uB294 \uADF8\uB8F9', [
        account('\uD604\uAE08', '\uC9C0\uAC11 \uB4F1\uC5D0 \uBCF4\uAD00\uD55C \uD604\uAE08'),
        account('\uC740\uD589 \uC608\uAE08', '\uC740\uD589 \uACC4\uC88C\uC5D0 \uBCF4\uAD00\uD55C \uB3C8'),
      ]),
    ],
    Liabilities: [account('\uC2E0\uC6A9\uCE74\uB4DC \uBBF8\uACB0\uC81C\uAE08', '\uC2E0\uC6A9\uCE74\uB4DC\uB85C \uC0AC\uC6A9\uD558\uACE0 \uC544\uC9C1 \uAC1A\uC9C0 \uC54A\uC740 \uAE08\uC561')],
    Equity: [account('\uC2DC\uC791 \uC794\uC561', '\uAE30\uB85D\uC744 \uC2DC\uC791\uD560 \uB54C \uAC00\uC9C4 \uC790\uC0B0\uACFC \uBD80\uCC44\uC758 \uCC28\uC561')],
    Revenue: [account('\uAE09\uC5EC', '\uC77C\uD55C \uB300\uAC00\uB85C \uBC1B\uC740 \uAE09\uC5EC')],
    Expenses: [
      group('\uC0DD\uD65C\uBE44', '\uC77C\uC0C1\uC0DD\uD65C\uC5D0 \uC4F4 \uBE44\uC6A9\uC744 \uBAA8\uC544 \uBCF4\uB294 \uADF8\uB8F9', [
        account('\uC2DD\uBE44', '\uC2DD\uC7AC\uB8CC \uAD6C\uC785\uACFC \uC678\uC2DD\uC5D0 \uC4F4 \uB3C8'),
        account('\uAD50\uD1B5\uBE44', '\uB300\uC911\uAD50\uD1B5 \uB4F1 \uC774\uB3D9\uC5D0 \uC4F4 \uB3C8'),
        account('\uAE30\uD0C0 \uC0DD\uD65C\uBE44', '\uBCC4\uB3C4 \uACC4\uC815\uACFC\uBAA9\uC73C\uB85C \uB098\uB204\uC9C0 \uC54A\uC740 \uC0DD\uD65C \uC9C0\uCD9C'),
      ]),
    ],
  },
  ja: {
    Assets: [
      group('\u73FE\u91D1\u30FB\u9810\u91D1', '\u73FE\u91D1\u3068\u9280\u884C\u9810\u91D1\u3092\u307E\u3068\u3081\u3066\u898B\u308B\u30B0\u30EB\u30FC\u30D7', [
        account('\u73FE\u91D1', '\u8CA1\u5E03\u306A\u3069\u306B\u4FDD\u7BA1\u3057\u3066\u3044\u308B\u73FE\u91D1'),
        account('\u9280\u884C\u9810\u91D1', '\u9280\u884C\u53E3\u5EA7\u306B\u9810\u3051\u3066\u3044\u308B\u304A\u91D1'),
      ]),
    ],
    Liabilities: [account('\u30AF\u30EC\u30B8\u30C3\u30C8\u30AB\u30FC\u30C9\u672A\u6255\u91D1', '\u30AF\u30EC\u30B8\u30C3\u30C8\u30AB\u30FC\u30C9\u3067\u4F7F\u3044\u3001\u307E\u3060\u8FD4\u6E08\u3057\u3066\u3044\u306A\u3044\u91D1\u984D')],
    Equity: [account('\u958B\u59CB\u6B8B\u9AD8', '\u8A18\u9332\u3092\u59CB\u3081\u305F\u3068\u304D\u306E\u8CC7\u7523\u3068\u8CA0\u50B5\u306E\u5DEE\u984D')],
    Revenue: [account('\u7D66\u4E0E', '\u50CD\u3044\u305F\u5BFE\u4FA1\u3068\u3057\u3066\u53D7\u3051\u53D6\u3063\u305F\u7D66\u4E0E')],
    Expenses: [
      group('\u751F\u6D3B\u8CBB', '\u65E5\u5E38\u751F\u6D3B\u306B\u304B\u304B\u3063\u305F\u8CBB\u7528\u3092\u307E\u3068\u3081\u3066\u898B\u308B\u30B0\u30EB\u30FC\u30D7', [
        account('\u98DF\u8CBB', '\u98DF\u6750\u306E\u8CFC\u5165\u3068\u5916\u98DF\u306B\u4F7F\u3063\u305F\u304A\u91D1'),
        account('\u4EA4\u901A\u8CBB', '\u516C\u5171\u4EA4\u901A\u6A5F\u95A2\u306A\u3069\u79FB\u52D5\u306B\u4F7F\u3063\u305F\u304A\u91D1'),
        account('\u305D\u306E\u4ED6\u306E\u751F\u6D3B\u8CBB', '\u500B\u5225\u306E\u52D8\u5B9A\u79D1\u76EE\u306B\u5206\u3051\u3066\u3044\u306A\u3044\u751F\u6D3B\u306E\u652F\u51FA'),
      ]),
    ],
  },
};

export const flattened = (nodes: readonly InitialNode[]): readonly InitialNode[] =>
  nodes.flatMap((node) => (node.kind === 'group' ? [node, ...node.members] : [node]));

export const initialAccounts = (chart: InitialChart): readonly InitialAccount[] =>
  ACCOUNT_TYPES.flatMap((type) =>
    flattened(chart[type]).filter((node): node is InitialAccount => node.kind === 'account'),
  );

export const initialGroups = (chart: InitialChart): readonly InitialGroup[] =>
  ACCOUNT_TYPES.flatMap((type) => chart[type].filter((node): node is InitialGroup => node.kind === 'group'));

type SettingsText = {
  readonly section: string;
  readonly types: Readonly<Record<AccountType, string>>;
  readonly move: (name: string) => string;
  readonly anyMove: RegExp;
};

const SETTINGS_TEXT: Readonly<Record<Language, SettingsText>> = {
  en: {
    section: 'Accounts',
    types: { Assets: 'Assets', Liabilities: 'Liabilities', Equity: 'Equity', Revenue: 'Revenue', Expenses: 'Expenses' },
    move: (name) => `Move ${name}`,
    anyMove: /^Move /,
  },
  ko: {
    section: '\uACC4\uC815',
    types: { Assets: '\uC790\uC0B0', Liabilities: '\uBD80\uCC44', Equity: '\uC790\uBCF8', Revenue: '\uC218\uC775', Expenses: '\uBE44\uC6A9' },
    move: (name) => `${name} \uC774\uB3D9`,
    anyMove: / \uC774\uB3D9$/,
  },
  ja: {
    section: '\u52D8\u5B9A\u79D1\u76EE',
    types: { Assets: '\u8CC7\u7523', Liabilities: '\u8CA0\u50B5', Equity: '\u8CC7\u672C', Revenue: '\u53CE\u76CA', Expenses: '\u8CBB\u7528' },
    move: (name) => `${name}\u3092\u79FB\u52D5`,
    anyMove: /\u3092\u79FB\u52D5$/,
  },
};

const typeIn = (page: Page, shown: Language, type: AccountType): Locator => {
  const text = SETTINGS_TEXT[shown];
  return page
    .getByRole('region', { name: text.section, exact: true })
    .getByRole('group', { name: text.types[type], exact: true });
};

const gripIn = (scope: Locator | Page, shown: Language, name: string): Locator =>
  scope.getByRole('button', { name: SETTINGS_TEXT[shown].move(name), exact: true });

const nodeRow = (scope: Locator, shown: Language, name: string): Locator =>
  scope.getByRole('listitem').filter({ has: gripIn(scope.page(), shown, name) }).last();

export async function expectChartInSettings(page: Page, shown: Language, chart: InitialChart): Promise<void> {
  const text = SETTINGS_TEXT[shown];
  for (const type of ACCOUNT_TYPES) {
    const scope = typeIn(page, shown, type);
    const nodes = flattened(chart[type]);
    const grips = scope.getByRole('button', { name: text.anyMove });
    await expect(grips, type).toHaveCount(nodes.length);
    for (const [index, node] of nodes.entries()) {
      await expect(grips.nth(index)).toHaveAccessibleName(text.move(node.name));
      await expect(nodeRow(scope, shown, node.name)).toContainText(node.description);
    }
    for (const node of chart[type]) {
      const held = node.kind === 'group' ? node.members : [];
      const nodeScope = nodeRow(scope, shown, node.name);
      await expect(nodeScope.getByRole('button', { name: text.anyMove })).toHaveCount(1 + held.length);
      for (const member of held) {
        await expect(gripIn(nodeScope, shown, member.name)).toHaveCount(1);
      }
    }
  }
}

export const initialNames = (type: AccountType): readonly string[] =>
  flattened(INITIAL_CHART.en[type]).map(({ name }) => name);

export const chartNames = (language: Language): readonly string[] =>
  ACCOUNT_TYPES.flatMap((type) => flattened(INITIAL_CHART[language][type]).map(({ name }) => name));
