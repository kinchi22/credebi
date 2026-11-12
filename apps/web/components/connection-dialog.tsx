'use client';

import { PANEL_FRAME } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { CloseButton } from './close-button';
import { BOTTOM_SHEET, BUTTON, CHOSEN_SEGMENT, CONTROL, SEGMENT, UNCHOSEN_SEGMENT } from './control-classes';
import { SheetBar, SheetTabs, type TabsLook } from './sheet';
import { LINK, MUTED_TEXT } from './text-classes';
import { type ModalDialog } from './use-modal-dialog';

export type ConnectionDialogProps = {
  readonly dialog: ModalDialog;
  readonly mcpUrl: string;
};

const MCP_CLIENTS = ['claude', 'chatgpt'] as const;

type McpClient = (typeof MCP_CLIENTS)[number];

type Copying = {
  readonly outcome: 'idle' | 'copied' | 'refused';
  readonly attempt: number;
};

const NOT_COPIED: Copying = { outcome: 'idle', attempt: 0 };

const COPIED_FOR_MS = 2000;

const SEGMENT_TAB = `flex-1 text-center ${SEGMENT} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`;

const SEGMENT_TABS: TabsLook = {
  strip: `grid auto-cols-fr grid-flow-col p-0.5 ${PANEL_FRAME}`,
  idle: `${SEGMENT_TAB} ${UNCHOSEN_SEGMENT}`,
  shown: `${SEGMENT_TAB} font-semibold ${CHOSEN_SEGMENT}`,
};

const HELP = {
  claudeApps: 'https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp',
  claudeCode: 'https://code.claude.com/docs/en/mcp',
  chatgpt: 'https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta',
} as const;

const claudeCodeCommand = (mcpUrl: string): string => `claude mcp add --transport http credebi ${mcpUrl}`;

const STEP = 'flex flex-col gap-2 pl-1 marker:font-semibold';
const GUIDANCE = 'flex flex-col gap-2';
const COMMAND = 'block rounded-control border border-border bg-ground px-3 py-2 font-sans wrap-anywhere';
const STEP_TITLE = 'font-semibold';

const writeToClipboard = (text: string): Promise<void> =>
  Promise.resolve().then(() => navigator.clipboard.writeText(text));

function fitHeight(field: HTMLTextAreaElement): void {
  field.style.height = 'auto';
  field.style.height = `${String(field.scrollHeight + field.offsetHeight - field.clientHeight)}px`;
}

function useFittedHeight(field: RefObject<HTMLTextAreaElement | null>): void {
  useLayoutEffect(() => {
    const element = field.current;
    const frame = element?.parentElement;
    if (element === null || frame === null || frame === undefined) {
      return undefined;
    }
    fitHeight(element);
    const observer = new ResizeObserver(() => {
      fitHeight(element);
    });
    observer.observe(frame);
    return () => {
      observer.disconnect();
    };
  }, [field]);
}

function CopyStep({ mcpUrl }: { readonly mcpUrl: string }): ReactNode {
  const t = useTranslations();
  const field = useRef<HTMLTextAreaElement>(null);
  const [copying, setCopying] = useState<Copying>(NOT_COPIED);
  useFittedHeight(field);

  useEffect(() => {
    if (copying.outcome !== 'copied') {
      return undefined;
    }
    const timer = setTimeout(() => {
      setCopying((current) => ({ ...current, outcome: 'idle' }));
    }, COPIED_FOR_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copying]);

  const settle = (attempt: number, outcome: Copying['outcome']): void => {
    setCopying((current) => (current.attempt === attempt ? { attempt, outcome } : current));
  };

  const copy = (): void => {
    const attempt = copying.attempt + 1;
    setCopying({ outcome: 'idle', attempt });
    writeToClipboard(mcpUrl).then(
      () => {
        settle(attempt, 'copied');
      },
      () => {
        field.current?.focus();
        field.current?.select();
        settle(attempt, 'refused');
      },
    );
  };

  const announcement = {
    idle: '',
    copied: t('connectionsSection.copiedStatus'),
    refused: t('connectionsSection.copyRefused'),
  }[copying.outcome];

  return (
    <li className={STEP}>
      <p className={STEP_TITLE}>{t('connectionsSection.copyStep')}</p>
      <div className="flex min-w-0 items-start gap-2">
        <textarea
          ref={field}
          readOnly
          rows={1}
          value={mcpUrl}
          aria-label={t('connectionsSection.mcpUrl')}
          className={`${CONTROL} field-sizing-content min-w-0 flex-1 resize-none py-2 break-all`}
        />
        <button type="button" onClick={copy} className={`${BUTTON} shrink-0`}>
          {copying.outcome === 'copied' ? t('connectionsSection.copied') : t('connectionsSection.copy')}
        </button>
      </div>
      <p role="status" className={MUTED_TEXT}>
        {announcement}
      </p>
    </li>
  );
}

function HelpLink({ href, children }: { readonly href: string; readonly children: ReactNode }): ReactNode {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${LINK} self-start`}>
      {children}
    </a>
  );
}

function ClaudeGuidance({ mcpUrl }: { readonly mcpUrl: string }): ReactNode {
  const t = useTranslations();
  return (
    <div className={GUIDANCE}>
      <p>{t('connectionsSection.guidance.claudeApps')}</p>
      <HelpLink href={HELP.claudeApps}>{t('connectionsSection.guidance.claudeAppsHelp')}</HelpLink>
      <p className="mt-2">{t('connectionsSection.guidance.claudeCode')}</p>
      <code className={COMMAND}>{claudeCodeCommand(mcpUrl)}</code>
      <HelpLink href={HELP.claudeCode}>{t('connectionsSection.guidance.claudeCodeHelp')}</HelpLink>
    </div>
  );
}

function ChatGptGuidance(): ReactNode {
  const t = useTranslations();
  return (
    <div className={GUIDANCE}>
      <p>{t('connectionsSection.guidance.chatgpt')}</p>
      <HelpLink href={HELP.chatgpt}>{t('connectionsSection.guidance.chatgptHelp')}</HelpLink>
    </div>
  );
}

function ClientStep({ mcpUrl }: { readonly mcpUrl: string }): ReactNode {
  const t = useTranslations();
  const id = useId();
  const [shown, setShown] = useState<McpClient>('claude');
  const tabId = (client: McpClient): string => `${id}-${client}-tab`;
  const panelId = (client: McpClient): string => `${id}-${client}-panel`;

  return (
    <li className={STEP}>
      <p className={STEP_TITLE}>{t('connectionsSection.clientStep')}</p>
      <SheetTabs
        tabs={MCP_CLIENTS}
        shown={shown}
        onShow={setShown}
        tabId={tabId}
        panelId={panelId}
        label={(client) => t(`connectionsSection.clients.${client}`)}
        look={SEGMENT_TABS}
      />
      {MCP_CLIENTS.map((client) => (
        <div
          key={client}
          id={panelId(client)}
          role="tabpanel"
          aria-labelledby={tabId(client)}
          className={shown === client ? 'block' : 'hidden'}
        >
          {client === 'claude' ? <ClaudeGuidance mcpUrl={mcpUrl} /> : <ChatGptGuidance />}
        </div>
      ))}
    </li>
  );
}

export function ConnectionDialog({ dialog, mcpUrl }: ConnectionDialogProps): ReactNode {
  const t = useTranslations();
  const titleId = useId();

  return (
    <dialog
      {...dialog.dialogProps}
      aria-labelledby={titleId}
      onClick={dialog.closeOnScrim}
      className={`${BOTTOM_SHEET} bg-surface wide:m-auto wide:w-[calc(100%-2rem)] wide:max-w-140 wide:rounded-panel wide:border wide:border-border`}
    >
      {dialog.open ? (
        <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
          <SheetBar titleId={titleId} title={t('connectionsSection.dialogTitle')}>
            <CloseButton label={t('connectionsSection.close')} onClose={dialog.close} />
          </SheetBar>
          <ol
            className={`min-h-0 grow list-decimal overflow-y-auto py-4 pr-4 pl-8 wide:py-6 wide:pr-6 wide:pl-10 ${typeClasses['body-sm']} flex flex-col gap-5`}
          >
            <CopyStep mcpUrl={mcpUrl} />
            <ClientStep mcpUrl={mcpUrl} />
            <li className={STEP}>
              <p className={STEP_TITLE}>{t('connectionsSection.approveStep')}</p>
              <p className={MUTED_TEXT}>{t('connectionsSection.approveBody')}</p>
            </li>
          </ol>
        </div>
      ) : null}
    </dialog>
  );
}
