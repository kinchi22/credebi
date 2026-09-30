import { Panel, StatusDot } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { MUTED_TEXT } from '../../components/control-classes';
import { RefreshButton } from '../../components/refresh-button';
import { en } from '../../messages/en';
import { createContext } from '../../server/context';
import { createCaller } from '../../server/root-router';
import { recheckHealth } from './actions';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<ReactNode> {
  const caller = createCaller(await createContext());
  if (await caller.auth.signedIn().catch(() => false)) {
    redirect('/entries');
  }
  const health = await caller.health.get();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8">
      <h1 className={typeClasses.h1}>{en.app.name}</h1>
      <nav>
        <Link href="/entries" className={`${typeClasses['body-sm']} text-accent-text underline`}>
          {en.home.entriesLink}
        </Link>
      </nav>

      <Panel title={en.healthPanel.title}>
        <div className="flex flex-col gap-2" data-testid="health">
          <StatusDot
            tone={health.status === 'healthy' ? 'positive' : 'negative'}
            label={health.status}
          />
          <ul className={MUTED_TEXT}>
            {health.components.map((component) => (
              <li key={component.name} data-testid={`component-${component.name}`}>
                {component.name}:{' '}
                {component.reachable ? en.healthPanel.reachable : en.healthPanel.unreachable}
              </li>
            ))}
          </ul>
          <time
            className={`${typeClasses.date} text-text-muted`}
            dateTime={health.checkedAt}
            data-testid="checked-at"
          >
            {en.healthPanel.checkedAt} {health.checkedAt}
          </time>
          <RefreshButton action={recheckHealth} />
        </div>
      </Panel>
    </main>
  );
}
