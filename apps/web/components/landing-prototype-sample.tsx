'use client';

import {
  type AccountGroupId,
  type AccountId,
  type AccountOutput,
  type ChartOutput,
  type EntryId,
  type IncomeStatementOutput,
  type Money,
  type PostedEntry,
  type TrendMonthOutput,
} from '@repo/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AssetsAndLiabilitiesTrendChart } from './assets-and-liabilities-trend-chart';
import { EntryList } from './entry-list';
import { IncomeStatementTables } from './income-statement-tables';

const m = (n: number): Money => n as Money;
const aid = (n: number): AccountId => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountId;
const gid = (n: number): AccountGroupId => `01900000-0000-7000-9000-${String(n).padStart(12, '0')}` as AccountGroupId;
const eid = (n: number): EntryId => `01900000-0000-7000-a000-${String(n).padStart(12, '0')}` as EntryId;

const TITLES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: { salary: 'Salary', coffee: 'Starbucks', subway: 'Subway', card: 'Card payment', groceries: 'Groceries', dinner: 'Team dinner', store: 'Convenience store' },
  ko: { salary: '급여', coffee: '스타벅스', subway: '지하철', card: '카드 대금', groceries: '장보기', dinner: '팀 회식', store: '편의점' },
  ja: { salary: '給与', coffee: 'スターバックス', subway: '地下鉄', card: 'カード代金', groceries: '買い物', dinner: 'チーム会食', store: 'コンビニ' },
};

const noop = (): Promise<void> => Promise.resolve();

function useSample(): {
  chart: ChartOutput;
  entries: PostedEntry[];
  statement: IncomeStatementOutput;
  months: TrendMonthOutput[];
} {
  const t = useTranslations('startingChart');
  const titles = TITLES[useLocale()] ?? TITLES['en'] ?? {};
  const acc = (n: number, accountType: AccountOutput['accountType'], name: string, groupId: AccountGroupId | null = null): AccountOutput => ({
    id: aid(n),
    accountType,
    groupId,
    name,
    description: null,
    activeFrom: '2025-01-01',
    activeUntil: null,
  });
  const cash = acc(1, 'asset', t('cash.name'), gid(1));
  const bank = acc(2, 'asset', t('bankDeposits.name'), gid(1));
  const card = acc(3, 'liability', t('creditCardPayable.name'));
  const salary = acc(4, 'revenue', t('salary.name'));
  const food = acc(5, 'expense', t('food.name'), gid(2));
  const transport = acc(6, 'expense', t('transportation.name'), gid(2));
  const other = acc(7, 'expense', t('otherLivingExpenses.name'), gid(2));

  const chart: ChartOutput = [
    { kind: 'group', group: { id: gid(1), accountType: 'asset', name: t('cashAndDeposits.name'), description: null }, accounts: [cash, bank] },
    { kind: 'account', account: card },
    { kind: 'account', account: salary },
    { kind: 'group', group: { id: gid(2), accountType: 'expense', name: t('livingExpenses.name'), description: null }, accounts: [food, transport, other] },
  ];

  const line = (a: AccountOutput, side: 'debit' | 'credit', amount: number): PostedEntry['lines'][number] => ({
    account: a.id,
    accountName: a.name,
    side,
    amount: m(amount),
  });
  const entry = (n: number, entryDate: string, title: string, lines: PostedEntry['lines'], total: number): PostedEntry => ({
    id: eid(n),
    entryDate,
    title,
    memo: '',
    lines,
    total: m(total),
    createdAt: `${entryDate}T09:00:00.000Z`,
  });
  const entries = [
    entry(1, '2026-11-25', titles['salary'] ?? '', [line(bank, 'debit', 3200000), line(salary, 'credit', 3200000)], 3200000),
    entry(3, '2026-11-21', titles['groceries'] ?? '', [line(food, 'debit', 48000), line(other, 'debit', 12000), line(card, 'credit', 60000)], 60000),
    entry(6, '2026-11-19', titles['dinner'] ?? '', [line(food, 'debit', 64000), line(card, 'credit', 44000), line(cash, 'credit', 20000)], 64000),
    entry(4, '2026-11-18', titles['subway'] ?? '', [line(transport, 'debit', 1550), line(cash, 'credit', 1550)], 1550),
  ];

  const statement: IncomeStatementOutput = {
    revenue: { total: m(3200000), rows: [{ kind: 'account', account: salary.id, name: salary.name, total: m(3200000) }] },
    expense: {
      total: m(1003800),
      rows: [
        {
          kind: 'group',
          group: gid(2),
          name: t('livingExpenses.name'),
          total: m(1003800),
          collapsed: false,
          accounts: [
            { kind: 'account', account: food.id, name: food.name, total: m(412300) },
            { kind: 'account', account: transport.id, name: transport.name, total: m(68500) },
            { kind: 'account', account: other.id, name: other.name, total: m(523000) },
          ],
        },
      ],
    },
    netIncome: m(2196200),
  };

  const assets = [18.2, 18.9, 19.4, 20.6, 21.1, 22.4, 23.0, 24.3, 25.8, 26.4, 28.1, 29.6];
  const liabilities = [1.4, 1.1, 1.6, 1.2, 0.9, 1.3, 1.5, 1.0, 1.2, 0.8, 1.1, 0.9];
  const months = assets.map((a, i): TrendMonthOutput => {
    const totalAssets = Math.round(a * 1000000);
    const totalLiabilities = Math.round((liabilities[i] ?? 0) * 1000000);
    const month = i === 0 ? '2025-12' : `2026-${String(i).padStart(2, '0')}`;
    return { month, totalAssets: m(totalAssets), totalLiabilities: m(totalLiabilities), netWorth: m(totalAssets - totalLiabilities) };
  });

  return { chart, entries, statement, months };
}

const BREATHING_ENTRY = 1;
const UNFOLD_AT = 0.5;
const UNFOLD_SLACK = 24;
const UNFOLD_MIN_SCROLL = 120;

function clickAtOnce(button: HTMLButtonElement): void {
  const transition = Object.getOwnPropertyDescriptor(Document.prototype, 'startViewTransition');
  if (transition !== undefined) Reflect.deleteProperty(Document.prototype, 'startViewTransition');
  button.click();
  if (transition !== undefined) Object.defineProperty(Document.prototype, 'startViewTransition', transition);
}

const UNFOLD_MS = 240;
const UNFOLD_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

type Spot = { readonly x: number; readonly y: number };

function spotsIn(entry: HTMLElement): Map<string, Spot> {
  const origin = entry.getBoundingClientRect();
  const spots = new Map<string, Spot>();
  entry.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    const name = element.style.viewTransitionName;
    if (name === '' || name === 'none') return;
    const rect = element.getBoundingClientRect();
    spots.set(name, { x: rect.left - origin.left, y: rect.top - origin.top });
  });
  return spots;
}

function namedIn(entry: HTMLElement): HTMLElement[] {
  return [...entry.querySelectorAll<HTMLElement>('[style]')].filter((element) => {
    const name = element.style.viewTransitionName;
    return name !== '' && name !== 'none';
  });
}

function ghostOf(entry: HTMLElement): HTMLElement {
  const rect = entry.getBoundingClientRect();
  const ghost = entry.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('data-testid');
  ghost.removeAttribute('role');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  Object.assign(ghost.style, {
    viewTransitionName: 'none',
    position: 'absolute',
    top: '0',
    left: '0',
    margin: '0',
    width: `${String(rect.width)}px`,
    height: `${String(rect.height)}px`,
    borderTopWidth: '0',
    background: 'transparent',
    pointerEvents: 'none',
  });
  const heading = ghost.firstElementChild?.firstElementChild;
  if (heading instanceof HTMLElement) heading.style.visibility = 'hidden';
  ghost.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    if (element.style.viewTransitionName !== '') {
      element.style.viewTransitionName = 'none';
      element.style.visibility = 'hidden';
    }
  });
  return ghost;
}

function fadeIn(element: Element, duration: number): void {
  element.animate({ opacity: [0, 1] }, { duration, easing: UNFOLD_EASING });
}

function unfoldInPlace(entry: HTMLElement, toggle: HTMLButtonElement): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    clickAtOnce(toggle);
    return;
  }
  entry.getAnimations({ subtree: true }).forEach((animation) => {
    animation.finish();
  });
  entry.querySelectorAll('[data-ghost]').forEach((ghost) => {
    ghost.remove();
  });
  const before = spotsIn(entry);
  const fromHeight = entry.getBoundingClientRect().height;
  const ghost = ghostOf(entry);
  ghost.dataset['ghost'] = '';
  clickAtOnce(toggle);
  window.requestAnimationFrame(() => {
    entry.append(ghost);
    const toHeight = entry.getBoundingClientRect().height;
    const origin = entry.getBoundingClientRect();
    entry.style.alignContent = 'start';
    entry
      .animate(
        { height: [`${String(fromHeight)}px`, `${String(toHeight)}px`], overflow: ['clip', 'clip'] },
        { duration: UNFOLD_MS, easing: UNFOLD_EASING },
      )
      .finished.finally(() => {
        entry.style.alignContent = '';
      })
      .catch(() => undefined);
    ghost
      .animate({ opacity: [1, 0] }, { duration: UNFOLD_MS * 0.6, easing: 'ease-out', fill: 'forwards' })
      .finished.then(() => {
        ghost.remove();
      })
      .catch(() => {
        ghost.remove();
      });
    namedIn(entry).forEach((element) => {
      const was = before.get(element.style.viewTransitionName);
      const rect = element.getBoundingClientRect();
      if (was === undefined) {
        fadeIn(element, UNFOLD_MS);
        return;
      }
      const dx = was.x - (rect.left - origin.left);
      const dy = was.y - (rect.top - origin.top);
      element.animate(
        { transform: [`translate(${String(dx)}px, ${String(dy)}px)`, 'translate(0, 0)'] },
        { duration: UNFOLD_MS, easing: UNFOLD_EASING },
      );
      [...element.children].slice(1).forEach((amount) => {
        fadeIn(amount, UNFOLD_MS);
      });
    });
    entry.querySelectorAll(':scope > div.contents:not([role]) > span, :scope > div.contents > [role="columnheader"], :scope > button').forEach((element) => {
      fadeIn(element, UNFOLD_MS);
    });
    entry.querySelectorAll<HTMLElement>(':scope > div.contents:not(:first-child) > [role="cell"]').forEach((cell) => {
      const style = getComputedStyle(cell);
      cell.animate(
        {
          borderTopColor: ['transparent', style.borderTopColor],
          borderLeftColor: ['transparent', style.borderLeftColor],
        },
        { duration: UNFOLD_MS, easing: UNFOLD_EASING },
      );
    });
  });
}

function breathingToggle(root: HTMLElement | null): HTMLButtonElement | null {
  return root?.querySelectorAll('[data-testid="entry"]')[BREATHING_ENTRY]?.querySelector<HTMLButtonElement>('button[aria-expanded]') ?? null;
}

export function EntriesPreview(): ReactNode {
  const { chart, entries } = useSample();
  const root = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const controls = { chart, titles: [], entryFormMode: 'two-line' as const, editEntry: () => Promise.resolve({ ok: true }) as never, deleteEntry: () => Promise.resolve({ ok: true }) as never };
  useEffect(() => {
    const node = probe.current;
    const toggle = breathingToggle(node);
    if (node === null || toggle === null) {
      setHeight(0);
      return undefined;
    }
    node.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
      element.style.viewTransitionName = 'none';
    });
    const collapsed = node.offsetHeight;
    const observer = new ResizeObserver(() => {
      if (node.offsetHeight > collapsed) {
        observer.disconnect();
        setHeight(node.offsetHeight);
      }
    });
    observer.observe(node);
    const started = window.setTimeout(() => {
      clickAtOnce(toggle);
    }, 0);
    return () => {
      window.clearTimeout(started);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (height === undefined) return undefined;
    let frame = 0;
    const follow = (): void => {
      frame = 0;
      const entry = root.current?.querySelectorAll('[data-testid="entry"]')[BREATHING_ENTRY];
      const toggle = breathingToggle(root.current);
      if (!(entry instanceof HTMLElement) || toggle === null) return;
      const pageTop = entry.getBoundingClientRect().top + window.scrollY;
      const line = Math.max(pageTop - window.innerHeight * UNFOLD_AT, UNFOLD_MIN_SCROLL);
      const open = toggle.getAttribute('aria-expanded') === 'true';
      if ((!open && window.scrollY > line + UNFOLD_SLACK) || (open && window.scrollY < line - UNFOLD_SLACK)) unfoldInPlace(entry, toggle);
    };
    const onScroll = (): void => {
      if (frame === 0) frame = window.requestAnimationFrame(follow);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    follow();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [height]);
  return (
    <div className="relative">
      {height === undefined ? (
        <div ref={probe} inert aria-hidden className="invisible absolute inset-x-0 top-0">
          <EntryList entries={entries} controls={controls} />
        </div>
      ) : null}
      <div inert ref={root} style={{ minHeight: height }} className="flex flex-col *:flex-1">
        <EntryList entries={entries} controls={controls} />
      </div>
    </div>
  );
}

export function TrendPreview(): ReactNode {
  const { months } = useSample();
  return (
    <div inert className="rounded-panel border border-border bg-surface p-2 wide:p-4">
      <AssetsAndLiabilitiesTrendChart months={months} lines={{ shown: ['net-worth', 'total-assets', 'total-liabilities'], keep: noop }} />
    </div>
  );
}

export function IncomeStatementPreview(): ReactNode {
  const { statement } = useSample();
  return (
    <div inert>
      <IncomeStatementTables statement={statement} period={{ from: '2026-11-01', to: '2026-11-30' }} keep={noop} />
    </div>
  );
}
