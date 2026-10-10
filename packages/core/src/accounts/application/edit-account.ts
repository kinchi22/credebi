import { ok, type DomainError, type EditAccountInput, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Account } from '../domain/account';
import { editedAccount } from '../domain/account-details';
import { changesActivePeriod, checkKeepsShownEntries } from '../domain/active-period';
import { type AccountRepository } from '../ports/account-repository';

export type EditAccountDependencies = {
  readonly accounts: AccountRepository;
};

export type EditAccount = (
  auth: AuthContext,
  input: EditAccountInput,
) => Promise<Result<Account, DomainError>>;

export function createEditAccount({ accounts }: EditAccountDependencies): EditAccount {
  return async (auth, { id, ...details }) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    const chart = await accounts.readChart(userId.value);
    if (!chart.ok) {
      return chart;
    }

    const account = editedAccount(chart.value, id, details);
    if (!account.ok) {
      return account;
    }

    if (changesActivePeriod(chart.value, account.value)) {
      const shown = await accounts.readShownSpan(userId.value, id);
      if (!shown.ok) {
        return shown;
      }
      const kept = checkKeepsShownEntries(account.value, shown.value);
      if (!kept.ok) {
        return kept;
      }
    }

    const saved = await accounts.updateAccount(userId.value, account.value);
    return saved.ok ? ok(account.value) : saved;
  };
}
