import {
  collapseAccountGroupInputSchema,
  type CollapseAccountGroupInput,
  type DomainErrorCode,
} from '@repo/contracts';
import { type Logger } from '@repo/core';
import { fromTrpcError } from './domain-error';

export type CollapseGroup = (input: CollapseAccountGroupInput) => Promise<void>;

function reportRefusal(logger: Logger, code: DomainErrorCode): void {
  logger.error(
    { event: 'accounts.collapse_refused', code },
    'Whether an Account group is collapsed was refused, so it was not kept.',
  );
}

export async function keepCollapsedGroup(
  collapse: CollapseGroup,
  logger: Logger,
  id: unknown,
  collapsed: unknown,
): Promise<void> {
  const input = collapseAccountGroupInputSchema.safeParse({ id, collapsed });
  if (!input.success) {
    reportRefusal(logger, 'INVALID_INPUT');
    return;
  }

  try {
    await collapse(input.data);
  } catch (thrown) {
    reportRefusal(logger, fromTrpcError(thrown).code);
  }
}
