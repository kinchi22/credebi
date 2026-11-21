'use client';

import { type Language } from '@repo/contracts';
import { Logo } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { PRIMARY_BUTTON, BUTTON } from './control-classes';
import { LanguageSwitch } from './language-switch';
import { EntriesPreview, IncomeStatementPreview, TrendPreview } from './landing-prototype-sample';

type Copy = {
  login: string;
  start: string;
  eyebrow: string;
  headline: string;
  sub: string;
  highlights: readonly { key: 'entries' | 'trend' | 'statement'; title: string; body: string }[];
  explainTitle: string;
  explainBody: string;
  source: string;
};

const COPY: Readonly<Record<string, Copy>> = {
  ko: {
    login: '로그인',
    start: '시작하기',
    eyebrow: '개인을 위한 복식부기',
    headline: '내 돈이 어디서 와서 어디로 갔는지, 한눈에.',
    sub: '모든 거래를 두 쪽으로 기록하면 잔액이 저절로 맞고, 자산·부채·수입·지출이 한 장부에서 이어집니다.',
    highlights: [
      { key: 'entries', title: '모든 거래를 두 쪽으로', body: '카드로 커피를 사면 식비가 늘고 카드 빚도 늘어납니다. Credebi는 두 쪽을 함께 기록해서 합계가 어긋나는 일이 없습니다.' },
      { key: 'trend', title: '순자산이 자라는 모습', body: '매달 말 자산과 부채, 그 차이인 순자산을 그래프로 봅니다. 기록만 하면 계산은 알아서 됩니다.' },
      { key: 'statement', title: '이번 달 얼마 벌고 얼마 썼나', body: '수입과 지출을 계정별로 모아 이번 달 남은 돈을 보여 줍니다. 그룹으로 묶어 큰 흐름만 볼 수도 있습니다.' },
    ],
    explainTitle: '회계를 몰라도 됩니다',
    explainBody: '복식부기는 "돈은 사라지지 않고 옮겨 갈 뿐"이라는 생각입니다. 어디서 왔는지와 어디로 갔는지를 함께 적으면, 장부가 스스로 맞는지 확인해 줍니다.',
    source: 'GitHub에서 소스 보기',
  },
  en: {
    login: 'Log in',
    start: 'Get started',
    eyebrow: 'Double-entry bookkeeping for one person',
    headline: 'See where your money came from, and where it went.',
    sub: 'Record every transaction on two sides and your balances always add up, with assets, liabilities, income and spending in one set of books.',
    highlights: [
      { key: 'entries', title: 'Every transaction, both sides', body: 'Buy a coffee by card and your food spending goes up, and so does what you owe the card. Credebi records both, so the totals never drift.' },
      { key: 'trend', title: 'Watch your net worth grow', body: 'See assets, liabilities and the difference between them at the end of every month. You record; the arithmetic is done for you.' },
      { key: 'statement', title: 'What came in, what went out', body: 'Income and spending, totalled by account, show what is left this month. Group accounts to see only the big picture.' },
    ],
    explainTitle: 'No accounting background needed',
    explainBody: 'Double-entry bookkeeping is one idea: money never disappears, it only moves. Write down where it came from and where it went, and the books check themselves.',
    source: 'View the source on GitHub',
  },
};

const REPO = 'https://github.com/kinchi22/credebi';
const SECTION = 'mx-auto w-full max-w-6xl px-4 wide:px-14';
const PREVIEWS = { entries: EntriesPreview, trend: TrendPreview, statement: IncomeStatementPreview } as const;

function useCopy(): Copy {
  const copy = COPY[useLocale()] ?? COPY['en'];
  if (copy === undefined) throw new Error('copy');
  return copy;
}

type Props = { readonly chooseLanguage: (language: Language) => Promise<void> };

function Header({ chooseLanguage, dark }: Props & { readonly dark?: boolean }): ReactNode {
  const c = useCopy();
  return (
    <header className={`${SECTION} flex items-center gap-3 py-4`}>
      <Logo variant="horizontal" tone={dark === true ? 'reverse' : 'color'} name="Credebi" height={28} />
      <span className="ml-auto" />
      <LanguageSwitch action={chooseLanguage} onDark={dark === true} opensDown />
      <Link href="/sign-in" className={`${BUTTON} inline-flex items-center`}>
        {c.login}
      </Link>
    </header>
  );
}

function Footer(): ReactNode {
  const c = useCopy();
  return (
    <footer className={`${SECTION} border-t border-border py-6 ${typeClasses['body-sm']} text-text-muted`}>
      <a href={REPO} aria-label={c.source} title={c.source} className="inline-flex text-text-muted hover:text-text">
        <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      </a>
    </footer>
  );
}

function Start({ big }: { readonly big?: boolean }): ReactNode {
  const c = useCopy();
  return (
    <Link href="/sign-in" className={`${PRIMARY_BUTTON} inline-flex items-center ${big === true ? 'h-12 px-6 text-body' : ''}`}>
      {c.start}
    </Link>
  );
}

export function VariantA({ chooseLanguage }: Props): ReactNode {
  const c = useCopy();
  return (
    <div className="min-h-screen bg-ground">
      <Header chooseLanguage={chooseLanguage} />
      <section className={`${SECTION} flex flex-col items-center gap-5 py-16 text-center wide:py-24`}>
        <p className={`${typeClasses.label} text-accent-text`}>{c.eyebrow}</p>
        <h1 className={`${typeClasses.display} max-w-3xl text-text`}>{c.headline}</h1>
        <p className={`${typeClasses.body} max-w-2xl text-text-muted`}>{c.sub}</p>
        <div className="flex gap-3">
          <Start big />
        </div>
      </section>
      {c.highlights.map((h, i) => {
        const Preview = PREVIEWS[h.key];
        return (
          <section key={h.key} className={`${SECTION} grid items-center gap-6 py-10 wide:grid-cols-5 wide:gap-12 wide:py-16`}>
            <div className={`flex flex-col gap-3 wide:col-span-2 ${i % 2 === 1 ? 'wide:order-2' : ''}`}>
              <h2 className={`${typeClasses.h2} text-text`}>{h.title}</h2>
              <p className={`${typeClasses.body} text-text-muted`}>{h.body}</p>
            </div>
            <div className="min-w-0 wide:col-span-3">
              <Preview />
            </div>
          </section>
        );
      })}
      <section className={`${SECTION} py-12`}>
        <div className="flex flex-col items-start gap-3 rounded-card bg-surface p-6 wide:p-10">
          <h2 className={`${typeClasses.h2} text-text`}>{c.explainTitle}</h2>
          <p className={`${typeClasses.body} max-w-2xl text-text-muted`}>{c.explainBody}</p>
          <Start />
        </div>
      </section>
      <Footer />
    </div>
  );
}

export function VariantB({ chooseLanguage }: Props): ReactNode {
  const c = useCopy();
  const [first, ...rest] = c.highlights;
  return (
    <div className="min-h-screen bg-ground">
      <div className="bg-ground-dark text-text-on-dark">
        <Header chooseLanguage={chooseLanguage} dark />
        <section className={`${SECTION} grid gap-8 pt-8 pb-0 wide:grid-cols-2 wide:gap-12 wide:pt-16`}>
          <div className="flex flex-col gap-[90px] pb-8 wide:translate-y-16 wide:justify-center wide:pb-0">
            <div className="flex flex-col items-start gap-5">
              <h1 className={`${typeClasses.display} text-text-on-dark`}>{c.headline}</h1>
              <p className={`${typeClasses.body} text-text-muted-on-dark`}>{c.sub}</p>
              <Start big />
            </div>
            <div className="flex flex-col gap-2 max-wide:hidden">
              <h2 className={`${typeClasses.h2} text-text-on-dark`}>{first?.title}</h2>
              <p className={`${typeClasses.body} text-text-muted-on-dark`}>
                {first?.body} {c.explainBody}
              </p>
            </div>
          </div>
          <div className="min-w-0 translate-y-8 rounded-card bg-ground p-2 text-text wide:translate-y-16 wide:p-3">
            <EntriesPreview />
          </div>
        </section>
      </div>
      <section className={`${SECTION} flex flex-col gap-2 pt-20 pb-6 wide:hidden`}>
        <h2 className={`${typeClasses.h2} text-text`}>{first?.title}</h2>
        <p className={`${typeClasses.body} text-text-muted`}>
          {first?.body} {c.explainBody}
        </p>
      </section>
      <div className="max-wide:hidden h-16" />
      {rest.map((h, i) => {
        const Preview = PREVIEWS[h.key];
        return (
          <section key={h.key} className={`${SECTION} grid items-center gap-6 py-10 wide:grid-cols-5 wide:gap-12 wide:py-16`}>
            <div className={`flex flex-col gap-3 wide:col-span-2 ${i % 2 === 0 ? 'wide:order-2' : ''}`}>
              <h2 className={`${typeClasses.h2} text-text`}>{h.title}</h2>
              <p className={`${typeClasses.body} text-text-muted`}>{h.body}</p>
            </div>
            <div className="min-w-0 wide:col-span-3">
              <Preview />
            </div>
          </section>
        );
      })}
      <section className={`${SECTION} flex justify-center py-16 wide:py-24`}>
        <Start big />
      </section>
      <Footer />
    </div>
  );
}

export function VariantC({ chooseLanguage }: Props): ReactNode {
  const c = useCopy();
  const [chosen, setChosen] = useState(0);
  const current = c.highlights[chosen] ?? c.highlights[0];
  const Preview = PREVIEWS[current?.key ?? 'entries'];
  return (
    <div className="min-h-screen bg-surface">
      <Header chooseLanguage={chooseLanguage} />
      <section className={`${SECTION} grid gap-6 py-12 wide:grid-cols-2 wide:items-end wide:py-20`}>
        <h1 className={`${typeClasses.display} text-text`}>{c.headline}</h1>
        <div className="flex flex-col items-start gap-4">
          <p className={`${typeClasses.body} text-text-muted`}>{c.sub}</p>
          <div className="flex gap-3">
            <Start />
            <Link href="/sign-in" className={`${BUTTON} inline-flex items-center`}>
              {c.login}
            </Link>
          </div>
        </div>
      </section>
      <section className={`${SECTION} pb-12`}>
        <div className="grid gap-4 rounded-card bg-ground p-3 wide:grid-cols-[18rem_1fr] wide:p-6">
          <div role="tablist" className="flex flex-col gap-2">
            {c.highlights.map((h, i) => (
              <button
                key={h.key}
                role="tab"
                aria-selected={i === chosen}
                onClick={() => {
                  setChosen(i);
                }}
                className={`flex flex-col gap-1 rounded-panel border p-4 text-left ${i === chosen ? 'border-accent-text bg-surface' : 'border-transparent hover:bg-surface-hover'}`}
              >
                <span className={`${typeClasses.title} font-semibold text-text`}>{h.title}</span>
                <span className={`${typeClasses['body-sm']} text-text-muted ${i === chosen ? '' : 'max-wide:hidden'}`}>{h.body}</span>
              </button>
            ))}
          </div>
          <div className="min-w-0">
            <Preview />
          </div>
        </div>
      </section>
      <section className={`${SECTION} grid gap-4 border-t border-border py-12 wide:grid-cols-3`}>
        <h2 className={`${typeClasses.h2} text-text`}>{c.explainTitle}</h2>
        <p className={`${typeClasses.body} text-text-muted wide:col-span-2`}>{c.explainBody}</p>
      </section>
      <Footer />
    </div>
  );
}
