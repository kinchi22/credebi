'use client';

import { PANEL_FRAME } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CloseButton } from './close-button';
import { BUTTON, CHOSEN_SEGMENT, CONTROL, SEGMENT, UNCHOSEN_SEGMENT } from './control-classes';
import { SheetBar, SheetTabs, type TabsLook } from './sheet';
import { MUTED_TEXT } from './text-classes';
import { type ModalDialog } from './use-modal-dialog';

export type ConnectionDialogProps = {
  readonly dialog: ModalDialog;
  readonly mcpUrl: string;
};

const MCP_CLIENTS = ['claude', 'chatgpt'] as const;

type McpClient = (typeof MCP_CLIENTS)[number];

type Copying = 'idle' | 'copied' | 'refused';

const COPIED_FOR_MS = 2000;

const SEGMENT_TAB = `flex-1 text-center ${SEGMENT} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`;

const SEGMENT_TABS: TabsLook = {
  strip: `grid auto-cols-fr grid-flow-col p-0.5 ${PANEL_FRAME}`,
  idle: `${SEGMENT_TAB} ${UNCHOSEN_SEGMENT}`,
  shown: () => `${SEGMENT_TAB} font-semibold ${CHOSEN_SEGMENT}`,
};

const STEP = 'flex flex-col gap-2 pl-1 marker:font-semibold';
const STEP_TITLE = 'font-semibold';

const writeToClipboard = (text: string): Promise<void> =>
  Promise.resolve().then(() => navigator.clipboard.writeText(text));

function CopyStep({ mcpUrl }: { readonly mcpUrl: string }): ReactNode {
  const t = useTranslations();
  const field = useRef<HTMLTextAreaElement>(null);
  const [copying, setCopying] = useState<Copying>('idle');

  useEffect(() => {
    if (copying !== 'copied') {
      return undefined;
    }
    const timer = setTimeout(() => {
      setCopying('idle');
    }, COPIED_FOR_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copying]);

  const copy = (): void => {
    writeToClipboard(mcpUrl).then(
      () => {
        setCopying('copied');
      },
      () => {
        field.current?.focus();
        field.current?.select();
        setCopying('refused');
      },
    );
  };

  const announcement = {
    idle: '',
    copied: t('connectionsSection.copied'),
    refused: t('connectionsSection.copyRefused'),
  }[copying];

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
          {copying === 'copied' ? t('connectionsSection.copiedButton') : t('connectionsSection.copy')}
        </button>
      </div>
      <p role="status" className={`${typeClasses['body-dense']} text-text-muted`}>
        {announcement}
      </p>
    </li>
  );
}

function ClientStep(): ReactNode {
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
        />
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
      className="mx-0 mt-auto mb-0 max-h-none w-full max-w-none rounded-t-panel border-0 bg-surface p-0 text-text backdrop:bg-ground-dark/60 wide:m-auto wide:w-[calc(100%-2rem)] wide:max-w-140 wide:rounded-panel wide:border wide:border-border"
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
            <ClientStep />
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
