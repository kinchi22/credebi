import { typeClasses } from '@repo/ui/type-classes';

export const FIELD = `flex flex-col gap-1 ${typeClasses['body-sm']}`;
export const CONTROL = 'rounded border border-border-control bg-surface px-2 py-1 text-text';
export const BUTTON = `rounded border border-border-control bg-surface px-3 py-1 ${typeClasses['body-sm']} text-text disabled:opacity-50`;
export const PRIMARY_BUTTON = `rounded bg-accent px-3 py-1 ${typeClasses['body-sm']} font-semibold text-text disabled:opacity-50`;
export const PANEL = 'rounded-lg border border-border bg-surface p-4';
export const MUTED_TEXT = `${typeClasses['body-sm']} text-text-muted`;
export const REFUSAL_TEXT = `${typeClasses['body-sm']} text-danger`;
