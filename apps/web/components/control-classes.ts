import { typeClasses } from '@repo/ui/type-classes';

const FIELD_LAYOUT = 'flex flex-col gap-1';

export const FIELD = `${FIELD_LAYOUT} ${typeClasses['body-sm']}`;
export const DENSE_FIELD = `${FIELD_LAYOUT} ${typeClasses['body-dense']}`;
const CONTROL_FRAME = 'rounded border border-border-control bg-surface py-1 text-text';

export const CONTROL = `${CONTROL_FRAME} px-2`;
export const DATE_CONTROL = `${CONTROL} appearance-none ${typeClasses.date}`;
export const ICON_CONTROL = `${CONTROL_FRAME} inline-flex items-center justify-center px-1 disabled:opacity-50`;
export const LEGEND = `${typeClasses['body-sm']} font-semibold`;
export const BUTTON = `rounded border border-border-control bg-surface px-3 py-1 ${typeClasses['body-sm']} text-text disabled:opacity-50`;
export const PRIMARY_BUTTON = `rounded border border-transparent bg-accent px-3 py-1 ${typeClasses['body-sm']} font-semibold text-text disabled:opacity-50`;
