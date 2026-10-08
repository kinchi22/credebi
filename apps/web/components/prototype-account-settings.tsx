'use client';

import { PencilIcon, TrashIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useRef, useState, type ReactNode } from 'react';
import {
  BUTTON,
  CONFIRMATION_DIALOG,
  CONFIRMATION_PANEL,
  CONTROL,
  DANGER_BUTTON,
  DATE_CONTROL,
  FIELD,
  LEGEND,
  PRIMARY_BUTTON,
  ROW_ICON_BUTTON,
} from './control-classes';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';

const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
type AccountType = (typeof TYPES)[number];
const TYPE_NAMES: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
};

type Item = {
  id: string;
  kind: 'account' | 'group';
  type: AccountType;
  groupId?: string | undefined;
  name: string;
  description: string;
  from?: string | undefined;
  until?: string | undefined;
  used?: boolean | undefined;
};

const SIGNUP = '2026-09-20';
const TODAY = '2026-10-09';

const SEED: Item[] = [
  { id: 'a1', kind: 'account', type: 'asset', name: 'Cash', description: '', from: SIGNUP, used: true },
  { id: 'g1', kind: 'group', type: 'asset', name: 'Bank', description: 'Every bank account I hold' },
  { id: 'a2', kind: 'account', type: 'asset', groupId: 'g1', name: 'ABC Bank', description: 'Salary comes in here', from: SIGNUP, used: true },
  { id: 'a3', kind: 'account', type: 'asset', groupId: 'g1', name: 'XYZ Savings', description: '', from: SIGNUP, until: '2026-09-30' },
  { id: 'a4', kind: 'account', type: 'liability', name: 'Accounts payable', description: '', from: SIGNUP },
  { id: 'g2', kind: 'group', type: 'liability', name: 'Cards', description: '' },
  { id: 'a5', kind: 'account', type: 'liability', groupId: 'g2', name: 'Visa', description: 'Paid on the 25th', from: '2026-10-01', used: true },
  { id: 'a6', kind: 'account', type: 'equity', name: 'Capital', description: '', from: SIGNUP, used: true },
  { id: 'a7', kind: 'account', type: 'revenue', name: 'Sales', description: '', from: SIGNUP },
  { id: 'a8', kind: 'account', type: 'expense', name: 'Expenses', description: '', from: SIGNUP, used: true },
  { id: 'g3', kind: 'group', type: 'expense', name: 'Living', description: 'Day-to-day costs' },
  { id: 'a9', kind: 'account', type: 'expense', groupId: 'g3', name: 'Food', description: '', from: SIGNUP, used: true },
  { id: 'a10', kind: 'account', type: 'expense', groupId: 'g3', name: 'Rent', description: '', from: SIGNUP },
];

type Draft = Omit<Item, 'id'> & { id?: string };

function period(item: Item): string {
  return `${item.from ?? ''} – ${item.until ?? 'open'}`;
}

function ended(item: Item): boolean {
  return item.until !== undefined && item.until < TODAY;
}

function useChart() {
  const [items, setItems] = useState<Item[]>(SEED);
  const [message, setMessage] = useState<string>();
  const save = (draft: Draft): void => {
    setMessage(undefined);
    if (draft.id) {
      setItems((all) => all.map((item) => (item.id === draft.id ? { ...item, ...draft, id: item.id } : item)));
    } else {
      setItems((all) => [...all, { ...draft, id: `n${String(all.length + 1)}` }]);
    }
  };
  const remove = (item: Item): void => {
    if (item.kind === 'account' && item.used) {
      setMessage(`"${item.name}" is named by an entry, so it cannot be removed. Set an end date to stop using it.`);
      return;
    }
    if (item.kind === 'group' && items.some((other) => other.groupId === item.id)) {
      setMessage(`"${item.name}" still holds accounts. Remove them first.`);
      return;
    }
    setMessage(undefined);
    setItems((all) => all.filter((other) => other.id !== item.id));
  };
  const loose = (type: AccountType): Item[] => items.filter((item) => item.type === type && !item.groupId);
  const inGroup = (group: Item): Item[] => items.filter((item) => item.groupId === group.id);
  return { items, setItems, save, remove, loose, inGroup, message };
}

type Chart = ReturnType<typeof useChart>;

function newAccount(type: AccountType, groupId?: string): Draft {
  return { kind: 'account', type, groupId, name: '', description: '', from: TODAY };
}

function newGroup(type: AccountType): Draft {
  return { kind: 'group', type, name: '', description: '' };
}

function ItemFields({
  draft,
  setDraft,
  chart,
}: {
  readonly draft: Draft;
  readonly setDraft: (draft: Draft) => void;
  readonly chart: Chart;
}): ReactNode {
  const groups = chart.items.filter((item) => item.kind === 'group' && item.type === draft.type);
  return (
    <div className="flex flex-col gap-3">
      <label className={FIELD}>
        Name
        <input className={CONTROL} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </label>
      <label className={FIELD}>
        Description
        <textarea
          className={CONTROL}
          rows={2}
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
      </label>
      {draft.kind === 'account' ? (
        <>
          <label className={FIELD}>
            Group
            <select
              className={CONTROL}
              value={draft.groupId ?? ''}
              onChange={(event) => setDraft({ ...draft, groupId: event.target.value || undefined })}
            >
              <option value="">None (directly under {TYPE_NAMES[draft.type]})</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3">
            <label className={FIELD}>
              Active from
              <input
                type="date"
                className={DATE_CONTROL}
                value={draft.from ?? ''}
                onChange={(event) => setDraft({ ...draft, from: event.target.value })}
              />
            </label>
            <label className={FIELD}>
              Active until (optional)
              <input
                type="date"
                className={DATE_CONTROL}
                value={draft.until ?? ''}
                onChange={(event) => setDraft({ ...draft, until: event.target.value || undefined })}
              />
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}

function useEditorDialog(chart: Chart) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft>();
  const open = (next: Draft): void => {
    setDraft(next);
    ref.current?.showModal();
  };
  const close = (): void => ref.current?.close();
  const dialog = (
    <dialog ref={ref} className={CONFIRMATION_DIALOG} onClose={() => setDraft(undefined)}>
      {draft ? (
        <form
          className={CONFIRMATION_PANEL}
          onSubmit={(event) => {
            event.preventDefault();
            chart.save(draft);
            close();
          }}
        >
          <h2 className={typeClasses.h2}>
            {draft.id ? 'Edit' : 'Add'} {draft.kind === 'group' ? 'group' : 'account'}
          </h2>
          <p className={MUTED_TEXT}>{TYPE_NAMES[draft.type]}</p>
          <ItemFields draft={draft} setDraft={setDraft} chart={chart} />
          <div className="flex justify-end gap-2">
            <button type="button" className={BUTTON} onClick={close}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY_BUTTON}>
              Save
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
  return { open, dialog };
}

function Refusal({ chart }: { readonly chart: Chart }): ReactNode {
  return chart.message ? (
    <p role="alert" className={DANGER_TEXT}>
      {chart.message}
    </p>
  ) : null;
}

function AccountMeta({ item }: { readonly item: Item }): ReactNode {
  return (
    <span className={`${typeClasses['body-dense']} text-text-muted`}>
      <span className={typeClasses.date}>{period(item)}</span>
      {item.description ? ` · ${item.description}` : ''}
    </span>
  );
}

function VariantA(): ReactNode {
  const chart = useChart();
  const editor = useEditorDialog(chart);
  const row = (item: Item): ReactNode => (
    <li key={item.id} className={`flex items-start justify-between gap-3 py-1 ${ended(item) ? 'opacity-60' : ''}`}>
      <button type="button" className="flex flex-col items-start text-left" onClick={() => editor.open(item)}>
        <span className="font-semibold">{item.name}</span>
        <AccountMeta item={item} />
      </button>
      <button type="button" className={BUTTON} onClick={() => chart.remove(item)}>
        Remove
      </button>
    </li>
  );
  return (
    <section className="flex flex-col gap-2">
      <h3 className={LEGEND}>Accounts — A: settings rows + dialog</h3>
      <Refusal chart={chart} />
      {TYPES.map((type) => (
        <div
          key={type}
          className="flex flex-col gap-3 border-t border-border py-4 wide:flex-row wide:justify-between"
        >
          <div className="flex flex-col gap-2">
            <span className={LEGEND}>{TYPE_NAMES[type]}</span>
            <div className="flex gap-2">
              <button type="button" className={BUTTON} onClick={() => editor.open(newAccount(type))}>
                + Account
              </button>
              <button type="button" className={BUTTON} onClick={() => editor.open(newGroup(type))}>
                + Group
              </button>
            </div>
          </div>
          <ul className={`flex flex-col gap-1 wide:w-[42rem] ${typeClasses['body-sm']}`}>
            {chart.loose(type).map((item) =>
              item.kind === 'account' ? (
                row(item)
              ) : (
                <li key={item.id} className="flex flex-col gap-1 rounded border border-border p-2">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" className="flex flex-col items-start text-left" onClick={() => editor.open(item)}>
                      <span className={`${typeClasses.label} text-text-muted`}>{item.name}</span>
                      {item.description ? <span className={`${typeClasses['body-dense']} text-text-muted`}>{item.description}</span> : null}
                    </button>
                    <div className="flex gap-2">
                      <button type="button" className={BUTTON} onClick={() => editor.open(newAccount(type, item.id))}>
                        + Account
                      </button>
                      <button type="button" className={BUTTON} onClick={() => chart.remove(item)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-1 pl-4">{chart.inGroup(item).map(row)}</ul>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
      {editor.dialog}
      <StateDump chart={chart} />
    </section>
  );
}

function VariantB(): ReactNode {
  const chart = useChart();
  const [draft, setDraft] = useState<Draft>();
  const [confirming, setConfirming] = useState(false);
  const pick = (next: Draft): void => {
    setDraft(next);
    setConfirming(false);
  };
  const treeItem = (item: Item, indent: boolean): ReactNode => (
    <li key={item.id}>
      <button
        type="button"
        onClick={() => pick(item)}
        className={`w-full rounded px-2 py-1 text-left ${indent ? 'pl-6' : ''} ${draft?.id === item.id ? 'bg-accent/15 font-semibold' : ''} ${item.kind === 'group' ? `${typeClasses.label} text-text-muted` : ''} ${ended(item) ? 'line-through opacity-60' : ''}`}
      >
        {item.name}
      </button>
    </li>
  );
  return (
    <section className="flex flex-col gap-2">
      <h3 className={LEGEND}>Accounts — B: tree + detail pane</h3>
      <div className="grid gap-4 border-y border-border py-4 wide:grid-cols-[18rem_1fr]">
        <nav className={`flex flex-col gap-3 ${typeClasses['body-sm']}`}>
          {TYPES.map((type) => (
            <div key={type} className="flex flex-col">
              <div className="flex items-center justify-between bg-band px-2 py-1">
                <span className={`${typeClasses.label} text-text-muted`}>{TYPE_NAMES[type]}</span>
                <span className="flex gap-2">
                  <button type="button" className="text-accent-text" onClick={() => pick(newAccount(type))}>
                    + Account
                  </button>
                  <button type="button" className="text-accent-text" onClick={() => pick(newGroup(type))}>
                    + Group
                  </button>
                </span>
              </div>
              <ul>
                {chart.loose(type).flatMap((item) => [
                  treeItem(item, false),
                  ...chart.inGroup(item).map((child) => treeItem(child, true)),
                ])}
              </ul>
            </div>
          ))}
        </nav>
        <div className="rounded border border-border bg-surface p-4">
          {draft ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                chart.save(draft);
              }}
            >
              <h4 className={typeClasses.h2}>
                {draft.id ? draft.name : `New ${draft.kind === 'group' ? 'group' : 'account'}`}
              </h4>
              <p className={MUTED_TEXT}>
                {TYPE_NAMES[draft.type]}
                {draft.kind === 'group' ? ` · group of ${String(chart.items.filter((item) => item.groupId === draft.id).length)} accounts` : ''}
              </p>
              <ItemFields draft={draft} setDraft={setDraft} chart={chart} />
              <Refusal chart={chart} />
              <div className="flex justify-between gap-2">
                {draft.id ? (
                  confirming ? (
                    <button
                      type="button"
                      className={DANGER_BUTTON}
                      onClick={() => {
                        const item = chart.items.find((other) => other.id === draft.id);
                        if (item) chart.remove(item);
                        setConfirming(false);
                      }}
                    >
                      Really remove
                    </button>
                  ) : (
                    <button type="button" className={BUTTON} onClick={() => setConfirming(true)}>
                      Remove
                    </button>
                  )
                ) : (
                  <span />
                )}
                <button type="submit" className={PRIMARY_BUTTON}>
                  Save
                </button>
              </div>
            </form>
          ) : (
            <p className={MUTED_TEXT}>Choose an account or a group, or add one.</p>
          )}
        </div>
      </div>
      <StateDump chart={chart} />
    </section>
  );
}

function VariantC(): ReactNode {
  const chart = useChart();
  const [editing, setEditing] = useState<Draft>();
  const [showEnded, setShowEnded] = useState(true);
  const inlineEditor = (key: string): ReactNode =>
    editing ? (
      <tr key={key}>
        <td colSpan={4} className="bg-band p-3">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              chart.save(editing);
              setEditing(undefined);
            }}
          >
            <ItemFields draft={editing} setDraft={setEditing} chart={chart} />
            <div className="flex justify-end gap-2">
              <button type="button" className={BUTTON} onClick={() => setEditing(undefined)}>
                Cancel
              </button>
              <button type="submit" className={PRIMARY_BUTTON}>
                Save
              </button>
            </div>
          </form>
        </td>
      </tr>
    ) : null;
  const line = (item: Item, indent: boolean): ReactNode[] => {
    if (item.kind === 'account' && !showEnded && ended(item)) return [];
    const row = (
      <tr key={item.id} className={`border-t border-border ${ended(item) ? 'opacity-60' : ''}`}>
        <td className={`py-1 pr-3 ${indent ? 'pl-6' : ''} ${item.kind === 'group' ? `${typeClasses.label} text-text-muted` : 'font-semibold'}`}>
          {item.name}
        </td>
        <td className={`py-1 pr-3 ${typeClasses['body-dense']} text-text-muted`}>{item.description}</td>
        <td className={`py-1 pr-3 ${typeClasses.date} text-text-muted`}>{item.kind === 'account' ? period(item) : ''}</td>
        <td className="py-1 text-right whitespace-nowrap">
          {item.kind === 'group' ? (
            <button type="button" className="mr-3 text-accent-text" onClick={() => setEditing(newAccount(item.type, item.id))}>
              + Account
            </button>
          ) : null}
          <button type="button" className="mr-3 text-accent-text" onClick={() => setEditing(item)}>
            Edit
          </button>
          <button type="button" className="text-text-muted" onClick={() => chart.remove(item)}>
            Remove
          </button>
        </td>
      </tr>
    );
    const editor = editing?.id === item.id || (editing && !editing.id && editing.groupId === item.id) ? inlineEditor(`${item.id}-edit`) : null;
    return [row, editor];
  };
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className={LEGEND}>Accounts — C: one outline table, inline editing</h3>
        <label className={`${typeClasses['body-sm']} flex items-center gap-2`}>
          <input type="checkbox" checked={showEnded} onChange={(event) => setShowEnded(event.target.checked)} />
          Show ended accounts
        </label>
      </div>
      <Refusal chart={chart} />
      <table className={`w-full border-y border-border ${typeClasses['body-sm']}`}>
        <thead>
          <tr className={`${typeClasses.label} text-text-muted`}>
            <th className="py-1 text-left">Name</th>
            <th className="py-1 text-left">Description</th>
            <th className="py-1 text-left">Active</th>
            <th />
          </tr>
        </thead>
        {TYPES.map((type) => (
          <tbody key={type}>
            <tr className="bg-band">
              <th colSpan={3} className={`px-2 py-1 text-left ${typeClasses.label}`}>
                {TYPE_NAMES[type]}
              </th>
              <td className="px-2 py-1 text-right whitespace-nowrap">
                <button type="button" className="mr-3 text-accent-text" onClick={() => setEditing(newAccount(type))}>
                  + Account
                </button>
                <button type="button" className="text-accent-text" onClick={() => setEditing(newGroup(type))}>
                  + Group
                </button>
              </td>
            </tr>
            {editing && !editing.id && editing.type === type && !editing.groupId ? inlineEditor(`${type}-new`) : null}
            {chart.loose(type).flatMap((item) => [
              ...line(item, false),
              ...chart.inGroup(item).flatMap((child) => line(child, true)),
            ])}
          </tbody>
        ))}
      </table>
      <StateDump chart={chart} />
    </section>
  );
}

function StateDump({ chart }: { readonly chart: Chart }): ReactNode {
  return (
    <details className={`${typeClasses['body-dense']} text-text-muted`}>
      <summary>Prototype state (today {TODAY}, signed up {SIGNUP}; used = named by an entry)</summary>
      <pre className="overflow-x-auto">{JSON.stringify(chart.items, null, 1)}</pre>
    </details>
  );
}

function GripIcon(): ReactNode {
  return (
    <svg aria-hidden="true" width="12" height="16" viewBox="0 0 12 16" className="fill-current">
      {[3, 8, 13].flatMap((y) => [<circle key={`l${String(y)}`} cx="3" cy={y} r="1.5" />, <circle key={`r${String(y)}`} cx="9" cy={y} r="1.5" />])}
    </svg>
  );
}

function VariantD(): ReactNode {
  const chart = useChart();
  const editor = useEditorDialog(chart);
  const [showEnded, setShowEnded] = useState(false);
  const [dragging, setDragging] = useState<Item>();
  const [over, setOver] = useState<string>();
  const [removing, setRemoving] = useState<Item>();
  const confirmRef = useRef<HTMLDialogElement>(null);
  const list = chart.items;

  const visible = (item: Item): boolean => item.kind === 'group' || showEnded || !ended(item);
  const loose = (type: AccountType): Item[] => list.filter((item) => item.type === type && !item.groupId);
  const inGroup = (group: Item): Item[] => list.filter((item) => item.groupId === group.id);

  const canDrop = (target: { type: AccountType; groupId?: string | undefined }): boolean =>
    dragging !== undefined && dragging.type === target.type && !(dragging.kind === 'group' && target.groupId);

  const move = (target: { type: AccountType; groupId?: string | undefined; before?: Item | undefined }): void => {
    if (!dragging || !canDrop(target)) return;
    const rest = list.filter((item) => item.id !== dragging.id);
    const movedItem: Item = { ...dragging, groupId: target.groupId };
    let index = target.before ? rest.findIndex((item) => item.id === target.before?.id) : -1;
    if (index < 0) {
      const lastOfTarget = rest.reduce((last, item, i) => (item.type === target.type && (target.groupId ? item.groupId === target.groupId || item.id === target.groupId : true) ? i : last), -1);
      index = lastOfTarget + 1;
    }
    chart.setItems([...rest.slice(0, index), movedItem, ...rest.slice(index)]);
    setDragging(undefined);
    setOver(undefined);
  };

  const dropProps = (key: string, target: { type: AccountType; groupId?: string | undefined; before?: Item | undefined }) => ({
    onDragOver: (event: React.DragEvent) => {
      if (canDrop(target)) {
        event.preventDefault();
        setOver(key);
      }
    },
    onDragLeave: () => setOver((current) => (current === key ? undefined : current)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      move(target);
    },
  });

  const actions = (item: Item): ReactNode => (
    <span className="flex shrink-0 gap-1">
      <button type="button" aria-label="Edit" className={ROW_ICON_BUTTON} onClick={() => editor.open(item)}>
        <PencilIcon />
      </button>
      <button
        type="button"
        aria-label="Delete"
        className={ROW_ICON_BUTTON}
        onClick={() => {
          setRemoving(item);
          confirmRef.current?.showModal();
        }}
      >
        <TrashIcon />
      </button>
    </span>
  );

  const handle = (item: Item): ReactNode => (
    <span
      draggable
      aria-hidden="true"
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        const row = (event.currentTarget as HTMLElement).closest('li');
        if (row) event.dataTransfer.setDragImage(row, 0, 0);
        setDragging(item);
      }}
      onDragEnd={() => {
        setDragging(undefined);
        setOver(undefined);
      }}
      className="cursor-grab px-1 text-text-muted hover:text-text active:cursor-grabbing"
    >
      <GripIcon />
    </span>
  );

  const future = (item: Item): boolean => item.from !== undefined && item.from > TODAY;

  const accountRow = (item: Item, indent: boolean): ReactNode =>
    visible(item) ? (
      <li
        key={item.id}
        {...dropProps(item.id, { type: item.type, groupId: item.groupId, before: item })}
        className={`flex items-center gap-2 border-t-2 py-1.5 ${over === item.id ? 'border-accent' : 'border-transparent'} ${indent ? 'pl-6' : ''} ${ended(item) ? 'opacity-60' : ''} ${dragging?.id === item.id ? 'opacity-40' : ''}`}
      >
        {handle(item)}
        <span className="flex min-w-0 flex-1 flex-col">
          <span>
            {item.name}
            {future(item) ? <span className={`ml-2 ${typeClasses.date} text-text-muted`}>from {item.from}</span> : null}
            {ended(item) ? <span className={`ml-2 ${typeClasses.date} text-text-muted`}>ended {item.until}</span> : null}
          </span>
          {item.description ? <span className={`${typeClasses['body-dense']} text-text-muted`}>{item.description}</span> : null}
        </span>
        {actions(item)}
      </li>
    ) : null;

  const groupRow = (group: Item): ReactNode => (
    <li key={group.id} className={dragging?.id === group.id ? 'opacity-40' : ''}>
      <div
        {...dropProps(group.id, dragging?.kind === 'group' ? { type: group.type, before: group } : { type: group.type, groupId: group.id })}
        className={`flex items-center gap-2 border-t-2 pt-3 pb-1 ${over === group.id ? 'border-accent' : 'border-transparent'}`}
      >
        {handle(group)}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{group.name}</span>
          {group.description ? <span className={`${typeClasses['body-dense']} text-text-muted`}>{group.description}</span> : null}
        </span>
        {actions(group)}
      </div>
      <ul>
        {inGroup(group).map((item) => accountRow(item, true))}
        {inGroup(group).length === 0 ? (
          <li className={`pl-6 py-1 ${typeClasses['body-dense']} text-text-muted`}>Drag accounts here</li>
        ) : null}
      </ul>
    </li>
  );

  return (
    <section className="flex flex-col gap-2 border-t border-border py-4">
      <div className="flex items-center justify-between">
        <h3 className={LEGEND}>Accounts</h3>
        <label className={`${typeClasses['body-sm']} flex items-center gap-2`}>
          <input type="checkbox" checked={showEnded} onChange={(event) => setShowEnded(event.target.checked)} />
          Show ended accounts
        </label>
      </div>
      <div className={`flex flex-col gap-4 ${typeClasses['body-sm']}`}>
        {TYPES.map((type) => (
          <div key={type} className="flex flex-col">
            <div
              {...dropProps(`${type}-band`, { type })}
              className={`flex items-center justify-between bg-band px-2 py-1 ${over === `${type}-band` ? 'outline-2 outline-accent' : ''}`}
            >
              <span className={`${typeClasses.label} text-text-muted`}>{TYPE_NAMES[type]}</span>
              <span className="flex gap-4">
                <button type="button" className="text-accent-text hover:underline" onClick={() => editor.open(newAccount(type))}>
                  + Account
                </button>
                <button type="button" className="text-accent-text hover:underline" onClick={() => editor.open(newGroup(type))}>
                  + Group
                </button>
              </span>
            </div>
            <ul className="px-2">
              {loose(type).map((item) => (item.kind === 'group' ? groupRow(item) : accountRow(item, false)))}
            </ul>
          </div>
        ))}
      </div>
      {editor.dialog}
      <dialog ref={confirmRef} className={CONFIRMATION_DIALOG} onClose={() => setRemoving(undefined)}>
        {removing ? (
          <div className={CONFIRMATION_PANEL}>
            <h2 className={typeClasses.h2}>Delete {removing.kind === 'group' ? 'group' : 'account'}</h2>
            <p className="border-y border-border py-2 font-semibold">{removing.name}</p>
            <Refusal chart={chart} />
            <div className="flex justify-end gap-2">
              <button type="button" className={BUTTON} onClick={() => confirmRef.current?.close()}>
                Cancel
              </button>
              <button
                type="button"
                className={DANGER_BUTTON}
                onClick={() => {
                  const blocked = (removing.kind === 'account' && removing.used) || (removing.kind === 'group' && list.some((item) => item.groupId === removing.id));
                  chart.remove(removing);
                  if (!blocked) confirmRef.current?.close();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
      <details className={`${typeClasses['body-dense']} text-text-muted`}>
        <summary>Prototype state (today {TODAY}, signed up {SIGNUP}; used = named by an entry)</summary>
        <pre className="overflow-x-auto">{JSON.stringify(list, null, 1)}</pre>
      </details>
    </section>
  );
}

const PROTOTYPE_VARIANTS = { A: VariantA, B: VariantB, C: VariantC, D: VariantD } as const;

export type PrototypeVariant = keyof typeof PROTOTYPE_VARIANTS;

export function PrototypeAccountSettings({ variant }: { readonly variant: PrototypeVariant }): ReactNode {
  const Component = PROTOTYPE_VARIANTS[variant];
  return <Component key={variant} />;
}
