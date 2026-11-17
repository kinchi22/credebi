import { collapseAccountGroupInputSchema, type CollapseAccountGroupInput } from '@repo/contracts';
import { type Logger } from '@repo/core';
import { keepChoice } from './choice';

export type CollapseGroup = (input: CollapseAccountGroupInput) => Promise<void>;

export async function keepCollapsedGroup(
  collapse: CollapseGroup,
  logger: Logger,
  id: unknown,
  collapsed: unknown,
): Promise<void> {
  await keepChoice(
    {
      schema: collapseAccountGroupInputSchema,
      keep: collapse,
      logger,
      refusal: {
        fields: { event: 'accounts.collapse_refused' },
        message: 'Whether an Account group is collapsed was refused, so it was not kept.',
      },
    },
    { id, collapsed },
  );
}
