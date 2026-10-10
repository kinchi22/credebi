import {
  nodesOfType,
  type AccountGroupOutput,
  type AccountId,
  type AccountOutput,
  type AccountType,
  type ChartOutput,
} from '@repo/contracts';
import { hasEndedBy } from '@repo/core/accounts';

export type Branch = 'tee' | 'elbow';

type Shown = (account: AccountOutput) => boolean;

export function branchesOf(
  accounts: readonly AccountOutput[],
  shown: Shown,
): ReadonlyMap<AccountId, Branch> {
  const ids = accounts.filter(shown).map((account) => account.id);
  return new Map(
    ids.map((id, index): [AccountId, Branch] => [id, index === ids.length - 1 ? 'elbow' : 'tee']),
  );
}

export type Run =
  | { readonly kind: 'accounts'; readonly accounts: readonly AccountOutput[] }
  | {
      readonly kind: 'group';
      readonly group: AccountGroupOutput;
      readonly accounts: readonly AccountOutput[];
    };

export function runsOf(chart: ChartOutput, type: AccountType): readonly Run[] {
  const runs: Run[] = [];
  for (const node of nodesOfType(chart, type)) {
    const last = runs.at(-1);
    if (node.kind === 'group') {
      runs.push(node);
    } else if (last?.kind === 'accounts') {
      runs[runs.length - 1] = { kind: 'accounts', accounts: [...last.accounts, node.account] };
    } else {
      runs.push({ kind: 'accounts', accounts: [node.account] });
    }
  }
  return runs;
}

export type GroupRules = { readonly above: boolean; readonly below: boolean };

export type RuledRun = { readonly run: Run; readonly rules: GroupRules };

export function ruledRunsOf(runs: readonly Run[], shown: Shown): readonly RuledRun[] {
  const visible = runs.map((run) => run.accounts.some(shown));
  const last = visible.lastIndexOf(true);
  let before: Run['kind'] | undefined;
  return runs.map((run, index) => {
    const isGroup = run.kind === 'group';
    const rules = {
      above: isGroup && before === 'accounts',
      below: isGroup && index < last,
    };
    if (visible[index]) {
      before = run.kind;
    }
    return { run, rules };
  });
}

export type SectionFilter = {
  readonly showEnded: boolean;
  readonly today: string | undefined;
};

const mayHaveEnded = (account: AccountOutput, today: string | undefined): boolean =>
  today === undefined ? account.activeUntil !== null : hasEndedBy(account, today);

export const shownInSection =
  ({ showEnded, today }: SectionFilter): Shown =>
  (account) =>
    showEnded || !mayHaveEnded(account, today);

export const nameContains =
  (query: string): Shown =>
  (account) =>
    account.name.toLowerCase().includes(query.trim().toLowerCase());
