import { typeClasses } from '@repo/ui/type-classes';

const FIELD_LAYOUT = 'flex flex-col gap-1';

export const FIELD = `${FIELD_LAYOUT} ${typeClasses['body-sm']}`;
export const DENSE_FIELD = `${FIELD_LAYOUT} ${typeClasses['body-dense']}`;
const CONTROL_SHAPE = 'h-control rounded-control border';
const CONTROL_FRAME = `${CONTROL_SHAPE} border-border-control bg-surface text-text`;
const FOCUS_HALO = 'focus-visible:ring-3 focus-visible:ring-accent/25';
const TYPED_CONTROL = `px-2 ${FOCUS_HALO}`;

export const CONTROL = `${CONTROL_FRAME} ${TYPED_CONTROL}`;
export const SEARCH_ON_STRIP = `${CONTROL_SHAPE} border-transparent bg-ground text-text ${TYPED_CONTROL}`;
export const FIELD_LABEL = 'font-medium text-text-muted';
export const DATE_CONTROL = `${CONTROL} appearance-none ${typeClasses.date}`;
export const ICON_CONTROL = `${CONTROL_FRAME} inline-flex aspect-square items-center justify-center disabled:opacity-50`;
export const LEGEND = `${typeClasses['body-sm']} font-semibold`;
export const BUTTON = `h-control rounded-control border border-border-control bg-surface px-3 ${typeClasses['body-sm']} text-text disabled:opacity-50`;
export const DANGER_BUTTON = `h-control rounded-control border border-transparent bg-danger px-3 ${typeClasses['body-sm']} font-semibold text-surface disabled:opacity-50`;
export const BARE_ICON_BUTTON = 'inline-flex items-center justify-center rounded-control text-text-muted hover:text-text';
export const ROW_ICON_BUTTON = `-my-1.5 size-8 shrink-0 wide:-my-1 wide:size-7 ${BARE_ICON_BUTTON}`;
export const PRIMARY_BUTTON = `h-control rounded-control border border-transparent bg-accent px-3 ${typeClasses['body-sm']} font-semibold text-text disabled:opacity-50`;
export const CONFIRMATION_DIALOG = 'm-auto w-[calc(100%-2rem)] max-w-100 rounded-panel border border-border bg-surface p-0 text-text backdrop:bg-ground-dark/60';
export const CONFIRMATION_PANEL = 'flex flex-col gap-4 p-4 wide:p-6';
