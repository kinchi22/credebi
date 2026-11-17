import { describe, expect, it } from 'vitest';
import { domainError, type CollapseAccountGroupInput } from '@repo/contracts';
import { type LogFields, type Logger } from '@repo/core';
import { keepCollapsedGroup, type CollapseGroup } from './collapsed-group';
import { toTrpcError } from './domain-error';

const BANK = '01920000-0000-7000-8000-0000000000b1';

function recording(): { readonly logger: Logger; readonly logged: LogFields[] } {
  const logged: LogFields[] = [];
  return {
    logged,
    logger: {
      error: (fields) => {
        logged.push(fields);
      },
    },
  };
}

function keeping(): { readonly collapse: CollapseGroup; readonly kept: CollapseAccountGroupInput[] } {
  const kept: CollapseAccountGroupInput[] = [];
  return {
    kept,
    collapse: (input) => {
      kept.push(input);
      return Promise.resolve();
    },
  };
}

const refusing =
  (code: Parameters<typeof domainError>[0]): CollapseGroup =>
  () =>
    Promise.reject(toTrpcError(domainError(code, 'Refused.')));

describe('keepCollapsedGroup', () => {
  it.each([true, false])('keeps an Account group collapsed as %s, logging nothing', async (collapsed) => {
    const { logger, logged } = recording();
    const { collapse, kept } = keeping();

    await keepCollapsedGroup(collapse, logger, BANK, collapsed);

    expect(kept).toEqual([{ id: BANK, collapsed }]);
    expect(logged).toEqual([]);
  });

  it.each([
    ['an id that is not an Account group id', 'bank', true],
    ['a collapsed that is not a boolean', BANK, 'true'],
  ])('logs %s, and keeps nothing', async (_case, id, collapsed) => {
    const { logger, logged } = recording();
    const { collapse, kept } = keeping();

    await keepCollapsedGroup(collapse, logger, id, collapsed);

    expect(kept).toEqual([]);
    expect(logged).toEqual([{ event: 'accounts.collapse_refused', code: 'INVALID_INPUT' }]);
  });

  it.each(['NOT_FOUND', 'UNAUTHENTICATED', 'DEPENDENCY_UNAVAILABLE'] as const)(
    'logs a collapse refused as %s rather than throwing',
    async (code) => {
      const { logger, logged } = recording();

      await keepCollapsedGroup(refusing(code), logger, BANK, true);

      expect(logged).toEqual([{ event: 'accounts.collapse_refused', code }]);
    },
  );
});
