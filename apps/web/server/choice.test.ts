import { describe, expect, it } from 'vitest';
import { domainError } from '@repo/contracts';
import { type LogFields, type Logger } from '@repo/core';
import { z } from 'zod';
import { keepChoice, type KeptChoice } from './choice';
import { toTrpcError } from './domain-error';

const shownSchema = z.object({ shown: z.boolean() }).transform(({ shown }) => ({ hidden: !shown }));

type Hidden = z.output<typeof shownSchema>;

const REFUSAL = { fields: { event: 'choices.refused', choiceId: 'legend' }, message: 'Refused, so not kept.' };

function choosing(keep: KeptChoice<Hidden>['keep'] = () => Promise.resolve()) {
  const logged: { readonly fields: LogFields; readonly message: string }[] = [];
  const kept: Hidden[] = [];
  const logger: Logger = {
    error: (fields, message) => {
      logged.push({ fields, message });
    },
  };
  const choice: KeptChoice<Hidden> = {
    schema: shownSchema,
    keep: async (input) => {
      await keep(input);
      kept.push(input);
    },
    logger,
    refusal: REFUSAL,
  };
  return { choice, kept, logged };
}

describe('keepChoice', () => {
  it('keeps the choice as its schema reads it, logging nothing', async () => {
    const { choice, kept, logged } = choosing();

    await keepChoice(choice, { shown: false });

    expect(kept).toEqual([{ hidden: true }]);
    expect(logged).toEqual([]);
  });

  it('logs a choice its schema refuses as invalid, with the refusal fields and message, and keeps nothing', async () => {
    const { choice, kept, logged } = choosing();

    await keepChoice(choice, { shown: 'no' });

    expect(kept).toEqual([]);
    expect(logged).toEqual([
      { fields: { event: 'choices.refused', choiceId: 'legend', code: 'INVALID_INPUT' }, message: REFUSAL.message },
    ]);
  });

  it.each(['NOT_FOUND', 'UNAUTHENTICATED', 'DEPENDENCY_UNAVAILABLE'] as const)(
    'logs a choice refused as %s with the refusal fields rather than throwing',
    async (code) => {
      const { choice, kept, logged } = choosing(() => Promise.reject(toTrpcError(domainError(code, 'Refused.'))));

      await keepChoice(choice, { shown: true });

      expect(kept).toEqual([]);
      expect(logged).toEqual([
        { fields: { event: 'choices.refused', choiceId: 'legend', code }, message: REFUSAL.message },
      ]);
    },
  );

  it('lets a failure that is no refusal through, logging nothing', async () => {
    const broken = new Error('Not a refusal.');
    const { choice, logged } = choosing(() => Promise.reject(broken));

    await expect(keepChoice(choice, { shown: true })).rejects.toBe(broken);
    expect(logged).toEqual([]);
  });
});
