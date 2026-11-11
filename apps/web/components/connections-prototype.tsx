'use client';

import { type ConnectionOutput } from '@repo/contracts';
import { PANEL } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BUTTON, CHOSEN_SEGMENT, CONTROL, LEGEND, PRIMARY_BUTTON, SEGMENT, UNCHOSEN_SEGMENT } from './control-classes';
import { LINK, MUTED_TEXT } from './text-classes';
import { CloseButton } from './close-button';
import { useModalDialog } from './use-modal-dialog';

type Props = { readonly mcpUrl: string; readonly connections: readonly ConnectionOutput[] };

type Client = 'claude' | 'chatgpt';

const CLIENTS: readonly { key: Client; name: string }[] = [
  { key: 'claude', name: 'Claude' },
  { key: 'chatgpt', name: 'ChatGPT' },
];

const SCOPE: Record<string, string> = { read: '장부 읽기', write: '거래 기록' };

const COMMON_STEPS = [
  '사용하는 AI 애플리케이션에서 원격 MCP 서버(커스텀 커넥터)를 추가하고 위 MCP URL을 붙여 넣습니다.',
  '열리는 창에서 Credebi에 로그인합니다.',
  '요청한 권한을 확인하고 허용합니다.',
  '연결은 아래 목록에 나타나며, 언제든 해제할 수 있습니다.',
];

export const SAMPLE_CONNECTIONS: readonly ConnectionOutput[] = [
  {
    id: '0190a000-0000-7000-8000-000000000001' as ConnectionOutput['id'],
    clientName: 'Claude',
    redirectHost: 'claude.ai',
    scopes: ['read', 'write'],
    createdAt: '2026-10-02T03:00:00.000Z',
    lastUsedAt: '2026-11-10T09:12:00.000Z',
  },
  {
    id: '0190a000-0000-7000-8000-000000000002' as ConnectionOutput['id'],
    clientName: 'ChatGPT',
    redirectHost: 'chatgpt.com',
    scopes: ['read'],
    createdAt: '2026-09-14T03:00:00.000Z',
    lastUsedAt: '2026-10-21T09:12:00.000Z',
  },
  {
    id: '0190a000-0000-7000-8000-000000000003' as ConnectionOutput['id'],
    clientName: 'Claude Code — a very long client name that keeps going to test wrapping behaviour',
    redirectHost: '127.0.0.1',
    scopes: ['read', 'write'],
    createdAt: '2026-11-01T03:00:00.000Z',
    lastUsedAt: '2026-11-01T03:00:00.000Z',
  },
];

function day(instant: string): string {
  return new Date(instant).toLocaleDateString('ko-KR');
}

function CopyField({ value, compact = false }: { readonly value: string; readonly compact?: boolean }): ReactNode {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 gap-2">
        <input
          ref={input}
          readOnly
          value={value}
          aria-label="MCP URL"
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          className={`${CONTROL} min-w-0 flex-1 ${compact ? '' : 'wide:min-w-80'}`}
        />
        <button
          type="button"
          className={`${BUTTON} shrink-0`}
          onClick={() => {
            navigator.clipboard.writeText(value).then(
              () => {
                setState('copied');
                setTimeout(() => {
                  setState('idle');
                }, 2000);
              },
              () => {
                input.current?.select();
                setState('failed');
              },
            );
          }}
        >
          {state === 'copied' ? '복사됨' : '복사'}
        </button>
      </div>
      <p aria-live="polite" className={`${typeClasses['body-dense']} text-text-muted`}>
        {state === 'copied' ? 'MCP URL을 복사했습니다.' : state === 'failed' ? '복사하지 못했습니다. 선택된 주소를 직접 복사해 주세요.' : ''}
      </p>
    </div>
  );
}

function ClientGuide({ client }: { readonly client: Client }): ReactNode {
  if (client === 'claude') {
    return (
      <div className="flex flex-col gap-2">
        <p>
          <span className="font-semibold">claude.ai · 데스크톱 앱</span>: 설정 → 커넥터 → 커스텀 커넥터 추가에서 이름과 MCP URL을 입력합니다.{' '}
          <a className={LINK} href="https://support.claude.com/en/articles/11175166" target="_blank" rel="noreferrer">
            Claude 도움말
          </a>
        </p>
        <p>
          <span className="font-semibold">Claude Code</span>: 터미널에서 아래 명령을 실행한 뒤 <code>/mcp</code>에서 인증합니다.
        </p>
        <pre className={`${typeClasses['body-dense']} overflow-x-auto rounded-control bg-ground px-2 py-1`}>
          claude mcp add --transport http credebi {'<MCP URL>'}
        </pre>
      </div>
    );
  }
  return (
    <p>
      설정 → 앱 및 커넥터 → 고급 설정에서 개발자 모드를 켠 뒤, 커넥터 만들기에서 MCP URL을 입력하고 인증 방식으로 OAuth를 고릅니다.{' '}
      <a className={LINK} href="https://help.openai.com/" target="_blank" rel="noreferrer">
        ChatGPT 도움말
      </a>
    </p>
  );
}

function ScopeChips({ scopes }: { readonly scopes: readonly string[] }): ReactNode {
  return (
    <span className="flex flex-wrap gap-1">
      {scopes.map((s) => (
        <span
          key={s}
          className={`${typeClasses['body-dense']} rounded-control border px-1.5 ${s === 'write' ? 'border-accent-text text-accent-text' : 'border-border text-text-muted'}`}
        >
          {SCOPE[s] ?? s}
        </span>
      ))}
    </span>
  );
}

function RevokeButton({ name }: { readonly name: string }): ReactNode {
  return (
    <button
      type="button"
      aria-label={`${name} 연결 해제`}
      title="연결 해제"
      className="inline-flex size-8 shrink-0 items-center justify-center self-start rounded-control text-danger hover:bg-danger/10"
      onClick={() => alert('프로토타입: 해제 동작 없음')}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 17H7A5 5 0 0 1 7 7h2" />
        <path d="M15 7h2a5 5 0 0 1 4 8" />
        <path d="M8 12h4" />
        <path d="M2 2l20 20" />
      </svg>
    </button>
  );
}

function VariantA({ mcpUrl, connections }: Props): ReactNode {
  const has = connections.length > 0;
  return (
    <section className="flex flex-col gap-4 border-b border-border py-5">
      <h3 className={LEGEND}>연결</h3>
      <div className={`${PANEL} flex flex-col gap-3 ${typeClasses['body-sm']}`}>
        <div className="flex flex-col gap-1">
          <p className="font-semibold">새 MCP client 연결</p>
          <p className="text-text-muted">AI 애플리케이션이 이 주소로 장부를 읽거나 거래를 기록하게 할 수 있습니다.</p>
        </div>
        <CopyField value={mcpUrl} />
        <details open={!has} className="flex flex-col gap-2">
          <summary className="cursor-pointer font-medium">연결 방법</summary>
          <ol className="mt-2 ml-5 flex list-decimal flex-col gap-1">
            {COMMON_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="mt-3 flex flex-col divide-y divide-border border-y border-border">
            {CLIENTS.map((c) => (
              <details key={c.key} className="py-2">
                <summary className="cursor-pointer font-medium">
                  {c.name}
                                  </summary>
                <div className="mt-2">
                  <ClientGuide client={c.key} />
                </div>
              </details>
            ))}
          </div>
        </details>
      </div>
      <div className="flex flex-col gap-2">
        <p className={LEGEND}>승인된 연결</p>
        {has ? (
          <ul className={`${PANEL} flex flex-col ${typeClasses['body-sm']}`}>
            {connections.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0 wide:flex-row wide:items-start wide:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-semibold wrap-anywhere">{c.clientName}</p>
                  <p className="break-all text-text-muted">{c.redirectHost}</p>
                  <ScopeChips scopes={c.scopes} />
                  <p className="flex flex-wrap gap-x-4 text-text-muted">
                    <span>연결한 날 {day(c.createdAt)}</span>
                    <span>마지막 사용 {day(c.lastUsedAt)}</span>
                  </p>
                </div>
                <RevokeButton name={c.clientName} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={MUTED_TEXT}>아직 승인한 연결이 없습니다. 위 MCP URL로 첫 연결을 만들어 보세요.</p>
        )}
      </div>
    </section>
  );
}

function VariantB({ mcpUrl, connections }: Props): ReactNode {
  const dialog = useModalDialog({ closesWhenWide: false });
  const [client, setClient] = useState<Client>('claude');
  const open = (e: { currentTarget: HTMLElement }): void => {
    setClient('claude');
    dialog.show(e.currentTarget);
  };
  return (
    <section className="flex flex-col gap-3 border-b border-border py-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className={LEGEND}>연결</h3>
        {connections.length > 0 ? (
          <button type="button" className={BUTTON} onClick={open}>
            + 연결 추가
          </button>
        ) : null}
      </div>
      {connections.length === 0 ? (
        <div className={`${PANEL} flex flex-col items-center gap-3 py-8 text-center ${typeClasses['body-sm']}`}>
          <p className="font-semibold">AI 애플리케이션과 장부 연결하기</p>
          <p className="max-w-96 text-text-muted">Claude나 ChatGPT가 대화 중에 장부를 읽고 거래를 기록할 수 있게 합니다. 권한은 연결할 때 직접 고르며, 언제든 해제할 수 있습니다.</p>
          <button type="button" className={PRIMARY_BUTTON} onClick={open}>
            연결 시작하기
          </button>
        </div>
      ) : (
        <ul className={`grid gap-3 wide:grid-cols-2 ${typeClasses['body-sm']}`}>
          {connections.map((c) => (
            <li key={c.id} className={`${PANEL} flex flex-col gap-3`}>
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold wrap-anywhere">{c.clientName}</p>
                  <p className="break-all text-text-muted">{c.redirectHost}</p>
                </div>
                <RevokeButton name={c.clientName} />
              </div>
              <ScopeChips scopes={c.scopes} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-text-muted">
                <dt>연결한 날</dt>
                <dd className={typeClasses.date}>{day(c.createdAt)}</dd>
                <dt>마지막 사용</dt>
                <dd className={typeClasses.date}>{day(c.lastUsedAt)}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
      <dialog
        {...dialog.dialogProps}
        aria-label="새 MCP client 연결"
        onClick={dialog.closeOnScrim}
        className="m-auto w-[calc(100%-2rem)] max-w-140 rounded-panel border border-border bg-surface p-0 text-text backdrop:bg-ground-dark/60"
      >
        <div className={`flex flex-col gap-4 p-4 wide:p-6 ${typeClasses['body-sm']}`}>
          <div className="flex items-center justify-between">
            <p className="font-semibold">새 MCP client 연결</p>
            <CloseButton label="닫기" onClose={dialog.close} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-medium">1. MCP URL 복사</p>
            <CopyField value={mcpUrl} compact />
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-medium">2. 애플리케이션에 추가</p>
            <div role="tablist" className="grid grid-cols-2 gap-1 rounded-control border border-border p-1">
              {CLIENTS.map((c) => (
                <button
                  key={c.key}
                  role="tab"
                  type="button"
                  aria-selected={client === c.key}
                  onClick={() => {
                    setClient(c.key);
                  }}
                  className={`${SEGMENT} ${client === c.key ? CHOSEN_SEGMENT : UNCHOSEN_SEGMENT}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <ClientGuide client={client} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-medium">3. Credebi에 로그인하고 권한 허용</p>
            <p className="text-text-muted">애플리케이션이 연 창에서 로그인하고, 요청한 권한을 확인한 뒤 허용합니다. 연결은 이 페이지 목록에 나타납니다.</p>
          </div>
        </div>
      </dialog>
    </section>
  );
}

function VariantC({ mcpUrl, connections }: Props): ReactNode {
  const [client, setClient] = useState<Client>('claude');
  return (
    <section className="flex flex-col border-b border-border">
      <h3 className={`${LEGEND} pt-5`}>연결</h3>
      <div className="flex flex-col gap-3 border-b border-border py-5 wide:flex-row wide:items-start wide:justify-between">
        <div className={`${typeClasses['body-sm']} flex max-w-80 flex-col gap-1`}>
          <p className="font-medium">MCP URL</p>
          <p className="text-text-muted">AI 애플리케이션에 이 주소를 원격 MCP 서버로 추가하세요.</p>
        </div>
        <CopyField value={mcpUrl} />
      </div>
      <div className="flex flex-col gap-3 border-b border-border py-5 wide:flex-row wide:items-start wide:justify-between">
        <div className={`${typeClasses['body-sm']} flex max-w-80 flex-col gap-1`}>
          <p className="font-medium">연결 방법</p>
          <p className="text-text-muted">추가하면 Credebi 로그인과 권한 동의 화면이 열립니다.</p>
        </div>
        <div className={`flex w-full flex-col gap-2 wide:max-w-[42rem] ${typeClasses['body-sm']}`}>
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-control border border-border p-1">
            {CLIENTS.map((c) => (
              <button
                key={c.key}
                role="tab"
                type="button"
                aria-selected={client === c.key}
                onClick={() => {
                  setClient(c.key);
                }}
                className={`${SEGMENT} ${client === c.key ? CHOSEN_SEGMENT : UNCHOSEN_SEGMENT}`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <ClientGuide client={client} />
        </div>
      </div>
      <div className={`flex flex-col gap-2 py-5 ${typeClasses['body-sm']}`}>
        <p className="font-medium">
          승인된 연결 <span className="text-text-muted">{connections.length}</span>
        </p>
        {connections.length === 0 ? (
          <p className="text-text-muted">아직 없습니다.</p>
        ) : (
          <table className="w-full table-fixed border-collapse">
            <thead className="max-wide:sr-only">
              <tr className="text-left text-text-muted">
                <th className="w-2/5 py-1 font-normal">애플리케이션</th>
                <th className="py-1 font-normal">권한</th>
                <th className="py-1 font-normal">마지막 사용</th>
                <th className="w-24 py-1" />
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.id} className="border-t border-border max-wide:flex max-wide:flex-col max-wide:gap-1 max-wide:py-3">
                  <td className="py-2 align-top">
                    <p className="font-semibold wrap-anywhere">{c.clientName}</p>
                    <p className="break-all text-text-muted">
                      {c.redirectHost} · {day(c.createdAt)} 연결
                    </p>
                  </td>
                  <td className="py-2 align-top">
                    <ScopeChips scopes={c.scopes} />
                  </td>
                  <td className={`py-2 align-top text-text-muted ${typeClasses.date}`}>{day(c.lastUsedAt)}</td>
                  <td className="py-2 text-right align-top">
                    <RevokeButton name={c.clientName} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

const VARIANTS = [
  { key: 'A', name: '패널 + 접히는 안내', C: VariantA },
  { key: 'B', name: '목록 우선 + 연결 다이얼로그', C: VariantB },
  { key: 'C', name: 'Settings row + 탭 + 표', C: VariantC },
] as const;

export function ConnectionsPrototype({ mcpUrl, connections }: Props): ReactNode {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const current = params.get('variant') ?? 'A';
  const sample = params.get('sample') ?? '1';
  const index = Math.max(0, VARIANTS.findIndex((v) => v.key === current));
  const variant = VARIANTS[index] ?? VARIANTS[0];
  const shown = sample === '0' ? [] : sample === 'real' ? connections : SAMPLE_CONNECTIONS;

  const go = (next: { variant?: string; sample?: string }): void => {
    const p = new URLSearchParams(params.toString());
    if (next.variant !== undefined) p.set('variant', next.variant);
    if (next.sample !== undefined) p.set('sample', next.sample);
    router.replace(`${path}?${p.toString()}`, { scroll: false });
  };
  const step = (d: number): void => {
    const v = VARIANTS[(index + d + VARIANTS.length) % VARIANTS.length];
    if (v !== undefined) go({ variant: v.key });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  });

  const Variant = variant.C;
  return (
    <>
      <Variant mcpUrl={mcpUrl} connections={shown} />
      {process.env.NODE_ENV === 'production' ? null : (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black px-3 py-2 text-sm text-white shadow-lg">
          <button type="button" aria-label="이전 variant" onClick={() => step(-1)} className="px-2">
            ←
          </button>
          <span className="whitespace-nowrap">
            {variant.key} ({variant.name})
          </span>
          <button type="button" aria-label="다음 variant" onClick={() => step(1)} className="px-2">
            →
          </button>
          <span className="mx-1 h-4 w-px bg-white/40" />
          {(['0', '1', 'real'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => go({ sample: s })}
              className={`rounded-full px-2 ${sample === s ? 'bg-white text-black' : ''}`}
            >
              {s === '0' ? '연결 없음' : s === '1' ? '샘플 3개' : '실제'}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
