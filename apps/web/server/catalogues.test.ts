import { describe, expect, it } from 'vitest';
import { startingChartCopy } from './catalogues';

const STARTING_CHART = {
  en: {
    cashAndDeposits: { name: 'Cash and deposits', description: 'A group for viewing cash and bank deposits together' },
    cash: { name: 'Cash', description: 'Cash kept in a wallet or elsewhere' },
    bankDeposits: { name: 'Bank deposits', description: 'Money held in bank accounts' },
    creditCardPayable: { name: 'Credit card payable', description: 'Credit card spending that has not yet been repaid' },
    openingBalanceEquity: { name: 'Opening balance equity', description: 'The difference between assets and liabilities when recordkeeping begins' },
    salary: { name: 'Salary', description: 'Salary received for work' },
    livingExpenses: { name: 'Living expenses', description: 'A group for viewing everyday living expenses together' },
    food: { name: 'Food', description: 'Money spent on groceries and eating out' },
    transportation: { name: 'Transportation', description: 'Money spent on getting around, including public transport' },
    otherLivingExpenses: { name: 'Other living expenses', description: 'Living expenses not assigned to a separate account' },
  },
  ko: {
    cashAndDeposits: { name: '\uD604\uAE08\uACFC \uC608\uAE08', description: '\uD604\uAE08\uACFC \uC740\uD589 \uC608\uAE08\uC744 \uBAA8\uC544 \uBCF4\uB294 \uADF8\uB8F9' },
    cash: { name: '\uD604\uAE08', description: '\uC9C0\uAC11 \uB4F1\uC5D0 \uBCF4\uAD00\uD55C \uD604\uAE08' },
    bankDeposits: { name: '\uC740\uD589 \uC608\uAE08', description: '\uC740\uD589 \uACC4\uC88C\uC5D0 \uBCF4\uAD00\uD55C \uB3C8' },
    creditCardPayable: { name: '\uC2E0\uC6A9\uCE74\uB4DC \uBBF8\uACB0\uC81C\uAE08', description: '\uC2E0\uC6A9\uCE74\uB4DC\uB85C \uC0AC\uC6A9\uD558\uACE0 \uC544\uC9C1 \uAC1A\uC9C0 \uC54A\uC740 \uAE08\uC561' },
    openingBalanceEquity: { name: '\uC2DC\uC791 \uC794\uC561', description: '\uAE30\uB85D\uC744 \uC2DC\uC791\uD560 \uB54C \uAC00\uC9C4 \uC790\uC0B0\uACFC \uBD80\uCC44\uC758 \uCC28\uC561' },
    salary: { name: '\uAE09\uC5EC', description: '\uC77C\uD55C \uB300\uAC00\uB85C \uBC1B\uC740 \uAE09\uC5EC' },
    livingExpenses: { name: '\uC0DD\uD65C\uBE44', description: '\uC77C\uC0C1\uC0DD\uD65C\uC5D0 \uC4F4 \uBE44\uC6A9\uC744 \uBAA8\uC544 \uBCF4\uB294 \uADF8\uB8F9' },
    food: { name: '\uC2DD\uBE44', description: '\uC2DD\uC7AC\uB8CC \uAD6C\uC785\uACFC \uC678\uC2DD\uC5D0 \uC4F4 \uB3C8' },
    transportation: { name: '\uAD50\uD1B5\uBE44', description: '\uB300\uC911\uAD50\uD1B5 \uB4F1 \uC774\uB3D9\uC5D0 \uC4F4 \uB3C8' },
    otherLivingExpenses: { name: '\uAE30\uD0C0 \uC0DD\uD65C\uBE44', description: '\uBCC4\uB3C4 \uACC4\uC815\uACFC\uBAA9\uC73C\uB85C \uB098\uB204\uC9C0 \uC54A\uC740 \uC0DD\uD65C \uC9C0\uCD9C' },
  },
  ja: {
    cashAndDeposits: { name: '\u73FE\u91D1\u30FB\u9810\u91D1', description: '\u73FE\u91D1\u3068\u9280\u884C\u9810\u91D1\u3092\u307E\u3068\u3081\u3066\u898B\u308B\u30B0\u30EB\u30FC\u30D7' },
    cash: { name: '\u73FE\u91D1', description: '\u8CA1\u5E03\u306A\u3069\u306B\u4FDD\u7BA1\u3057\u3066\u3044\u308B\u73FE\u91D1' },
    bankDeposits: { name: '\u9280\u884C\u9810\u91D1', description: '\u9280\u884C\u53E3\u5EA7\u306B\u9810\u3051\u3066\u3044\u308B\u304A\u91D1' },
    creditCardPayable: { name: '\u30AF\u30EC\u30B8\u30C3\u30C8\u30AB\u30FC\u30C9\u672A\u6255\u91D1', description: '\u30AF\u30EC\u30B8\u30C3\u30C8\u30AB\u30FC\u30C9\u3067\u4F7F\u3044\u3001\u307E\u3060\u8FD4\u6E08\u3057\u3066\u3044\u306A\u3044\u91D1\u984D' },
    openingBalanceEquity: { name: '\u958B\u59CB\u6B8B\u9AD8', description: '\u8A18\u9332\u3092\u59CB\u3081\u305F\u3068\u304D\u306E\u8CC7\u7523\u3068\u8CA0\u50B5\u306E\u5DEE\u984D' },
    salary: { name: '\u7D66\u4E0E', description: '\u50CD\u3044\u305F\u5BFE\u4FA1\u3068\u3057\u3066\u53D7\u3051\u53D6\u3063\u305F\u7D66\u4E0E' },
    livingExpenses: { name: '\u751F\u6D3B\u8CBB', description: '\u65E5\u5E38\u751F\u6D3B\u306B\u304B\u304B\u3063\u305F\u8CBB\u7528\u3092\u307E\u3068\u3081\u3066\u898B\u308B\u30B0\u30EB\u30FC\u30D7' },
    food: { name: '\u98DF\u8CBB', description: '\u98DF\u6750\u306E\u8CFC\u5165\u3068\u5916\u98DF\u306B\u4F7F\u3063\u305F\u304A\u91D1' },
    transportation: { name: '\u4EA4\u901A\u8CBB', description: '\u516C\u5171\u4EA4\u901A\u6A5F\u95A2\u306A\u3069\u79FB\u52D5\u306B\u4F7F\u3063\u305F\u304A\u91D1' },
    otherLivingExpenses: { name: '\u305D\u306E\u4ED6\u306E\u751F\u6D3B\u8CBB', description: '\u500B\u5225\u306E\u52D8\u5B9A\u79D1\u76EE\u306B\u5206\u3051\u3066\u3044\u306A\u3044\u751F\u6D3B\u306E\u652F\u51FA' },
  },
} as const;

describe('startingChartCopy', () => {
  it.each(['en', 'ko', 'ja'] as const)(
    'names and describes every starting Account and Account group in %s',
    (language) => {
      expect(startingChartCopy(language)).toEqual(STARTING_CHART[language]);
    },
  );
});
