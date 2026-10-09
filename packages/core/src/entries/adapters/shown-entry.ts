import { and, eq, exists, isNull, not, type SQL } from 'drizzle-orm';
import { alias, QueryBuilder } from 'drizzle-orm/pg-core';
import { schema } from '@repo/db';

const reversing = alias(schema.entries, 'reversing');

export function reversed(id: typeof schema.entries.id): SQL {
  return exists(
    new QueryBuilder()
      .select({ id: reversing.id })
      .from(reversing)
      .where(eq(reversing.reversesEntryId, id)),
  );
}

export function shownEntry(): SQL | undefined {
  return and(isNull(schema.entries.reversesEntryId), not(reversed(schema.entries.id)));
}
