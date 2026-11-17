import { type DomainErrorCode } from '@repo/contracts';
import { type LogFields, type Logger } from '@repo/core';
import { type z } from 'zod';
import { fromTrpcError } from './domain-error';

export type ChoiceRefusal = {
  readonly fields: LogFields;
  readonly message: string;
};

export type KeptChoice<Input> = {
  readonly schema: z.ZodType<Input>;
  readonly keep: (input: Input) => Promise<void>;
  readonly logger: Logger;
  readonly refusal: ChoiceRefusal;
};

function reportRefusal(logger: Logger, { fields, message }: ChoiceRefusal, code: DomainErrorCode): void {
  logger.error({ ...fields, code }, message);
}

export async function keepChoice<Input>(
  { schema, keep, logger, refusal }: KeptChoice<Input>,
  choice: unknown,
): Promise<void> {
  const input = schema.safeParse(choice);
  if (!input.success) {
    reportRefusal(logger, refusal, 'INVALID_INPUT');
    return;
  }

  try {
    await keep(input.data);
  } catch (thrown) {
    reportRefusal(logger, refusal, fromTrpcError(thrown).code);
  }
}
