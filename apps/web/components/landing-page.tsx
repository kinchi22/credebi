import { type Language } from '@repo/contracts';
import { GitHubMark, Logo } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { BUTTON, LARGE_PRIMARY_BUTTON } from './control-classes';
import { LanguageSwitch } from './language-switch';
import { SIGN_IN_PATH } from '../server/return-path';

export type LandingPageProps = {
  readonly chooseLanguage: (language: Language) => Promise<void>;
};

type Highlight = 'entries' | 'trend' | 'statement';

const SOURCE_REPOSITORY = 'https://github.com/kinchi22/credebi';
const LOGO_HEIGHT = 28;
const SECTION = 'mx-auto w-full max-w-6xl px-4 wide:px-14';
const HERO_HIGHLIGHT: Highlight = 'entries';
const ROWS: readonly { readonly highlight: Highlight; readonly textFirst: boolean }[] = [
  { highlight: 'trend', textFirst: false },
  { highlight: 'statement', textFirst: true },
];

function GetStarted(): ReactNode {
  const t = useTranslations('landingPage');
  return (
    <Link href={SIGN_IN_PATH} className={`${LARGE_PRIMARY_BUTTON} inline-flex items-center`}>
      {t('getStarted')}
    </Link>
  );
}

function HighlightText({ highlight, onDark }: { readonly highlight: Highlight; readonly onDark: boolean }): ReactNode {
  const t = useTranslations('landingPage.highlights');
  return (
    <>
      <h2 className={`${typeClasses.h2} ${onDark ? 'text-text-on-dark' : 'text-text'}`}>{t(`${highlight}.title`)}</h2>
      <p className={`${typeClasses.body} ${onDark ? 'text-text-muted-on-dark' : 'text-text-muted'}`}>
        {t(`${highlight}.body`)}
      </p>
    </>
  );
}

function PreviewSlot({ className = '' }: { readonly className?: string }): ReactNode {
  return <div inert className={`min-h-80 min-w-0 rounded-card bg-ground p-2 text-text wide:p-3 ${className}`} />;
}

function Header({ chooseLanguage }: LandingPageProps): ReactNode {
  const t = useTranslations();
  return (
    <header className="bg-ground-dark">
      <div className={`${SECTION} flex items-center gap-3 py-4`}>
        <Logo variant="horizontal" tone="reverse" name={t('app.name')} height={LOGO_HEIGHT} />
        <span className="ml-auto flex items-center gap-3">
          <LanguageSwitch action={chooseLanguage} onDark />
          <Link href={SIGN_IN_PATH} className={`${BUTTON} inline-flex items-center focus-visible:outline-focus-on-dark`}>
            {t('landingPage.logIn')}
          </Link>
        </span>
      </div>
    </header>
  );
}

function Hero(): ReactNode {
  const t = useTranslations('landingPage');
  return (
    <>
      <div className="bg-ground-dark">
        <section className={`${SECTION} grid gap-8 pt-8 wide:grid-cols-2 wide:gap-12 wide:pt-16 wide:pb-24`}>
          <div className="flex flex-col gap-22.5 pb-8 wide:-mb-20 wide:justify-center wide:pt-20 wide:pb-0">
            <div className="flex flex-col items-start gap-5">
              <h1 className={`${typeClasses.display} text-text-on-dark`}>{t('headline')}</h1>
              <p className={`${typeClasses.body} text-text-muted-on-dark`}>{t('valueProposition')}</p>
              <GetStarted />
            </div>
            <div className="flex flex-col gap-2 max-wide:hidden">
              <HighlightText highlight={HERO_HIGHLIGHT} onDark />
            </div>
          </div>
          <PreviewSlot className="-mb-8 wide:-mb-40" />
        </section>
      </div>
      <section className={`${SECTION} flex flex-col gap-2 pt-20 pb-6 wide:hidden`}>
        <HighlightText highlight={HERO_HIGHLIGHT} onDark={false} />
      </section>
      <div className="h-16 max-wide:hidden" />
    </>
  );
}

function HighlightRow({ highlight, textFirst }: { readonly highlight: Highlight; readonly textFirst: boolean }): ReactNode {
  return (
    <section className={`${SECTION} grid items-center gap-6 py-10 wide:grid-cols-5 wide:gap-12 wide:py-16`}>
      <div className={`flex flex-col gap-3 wide:col-span-2 ${textFirst ? '' : 'wide:order-2'}`}>
        <HighlightText highlight={highlight} onDark={false} />
      </div>
      <PreviewSlot className="wide:col-span-3" />
    </section>
  );
}

function Footer(): ReactNode {
  const t = useTranslations('landingPage');
  return (
    <footer className={`${SECTION} border-t border-border py-6`}>
      <a
        href={SOURCE_REPOSITORY}
        aria-label={t('source')}
        title={t('source')}
        className="inline-flex rounded-control text-text-muted hover:text-text"
      >
        <GitHubMark />
      </a>
    </footer>
  );
}

export function LandingPage({ chooseLanguage }: LandingPageProps): ReactNode {
  return (
    <div className="min-h-screen bg-ground">
      <Header chooseLanguage={chooseLanguage} />
      <main>
        <Hero />
        {ROWS.map((row) => (
          <HighlightRow key={row.highlight} highlight={row.highlight} textFirst={row.textFirst} />
        ))}
        <section className={`${SECTION} flex justify-center py-16 wide:py-24`}>
          <GetStarted />
        </section>
      </main>
      <Footer />
    </div>
  );
}
