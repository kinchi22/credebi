import { typeClasses } from '@repo/ui/type-classes';

const FIELD_LAYOUT = 'flex flex-col gap-1';

export const FIELD = `${FIELD_LAYOUT} ${typeClasses['body-sm']}`;
export const DENSE_FIELD = `${FIELD_LAYOUT} ${typeClasses['body-dense']}`;
export const CONTROL = 'rounded border border-border-control bg-surface px-2 py-1 text-text';
export const LEGEND = `${typeClasses['body-sm']} font-semibold`;
export const BUTTON = `rounded border border-border-control bg-surface px-3 py-1 ${typeClasses['body-sm']} text-text disabled:opacity-50`;
export const PRIMARY_BUTTON = `rounded border border-transparent bg-accent px-3 py-1 ${typeClasses['body-sm']} font-semibold text-text disabled:opacity-50`;
