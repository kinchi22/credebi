import { ok, type DomainError, type Money, type Result } from '@repo/contracts';
import { chartInOrder, type Account, type Chart, type ChartNode } from '../../accounts/domain/account';
import { isActiveOn } from '../../accounts/domain/active-period';
import { addMoney, negateMoney } from '../../money/domain/money';
import {
  statementSection,
  sumsByAccount,
  type AccountSums,
  type SectionScope,
  type StatementSection,
} from './statement';

export type AssetsAndLiabilities = {
  readonly assets: StatementSection;
  readonly liabilities: StatementSection;
  readonly netWorth: Money;
};

export function assetsAndLiabilitiesWhere(
  nodes: readonly ChartNode[],
  scope: Pick<SectionScope, 'includes' | 'sums'>,
): Result<AssetsAndLiabilities, DomainError> {
  const assets = statementSection(nodes, { ...scope, accountType: 'asset' });
  if (!assets.ok) {
    return assets;
  }
  const liabilities = statementSection(nodes, { ...scope, accountType: 'liability' });
  if (!liabilities.ok) {
    return liabilities;
  }
  const netWorth = addMoney(assets.value.total, negateMoney(liabilities.value.total));
  return netWorth.ok
    ? ok({ assets: assets.value, liabilities: liabilities.value, netWorth: netWorth.value })
    : netWorth;
}

export function assetsAndLiabilities(
  chart: Chart,
  day: string,
  sums: readonly AccountSums[],
): Result<AssetsAndLiabilities, DomainError> {
  return assetsAndLiabilitiesWhere(chartInOrder(chart), {
    includes: (account: Account) => isActiveOn(account, day),
    sums: sumsByAccount(sums),
  });
}
