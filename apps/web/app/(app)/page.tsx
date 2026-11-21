import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { VariantA, VariantB, VariantC } from '../../components/landing-prototype-variants';
import { PrototypeSwitcher } from '../../components/prototype-switcher';
import { createContext } from '../../server/context';
import { createCaller } from '../../server/root-router';
import { chooseLanguage } from './sign-in/actions';

export const dynamic = 'force-dynamic';

const VARIANTS = [
  { key: 'A', name: 'Centered hero, alternating rows' },
  { key: 'B', name: 'Dark split hero, Entries up front' },
  { key: 'C', name: 'Editorial hero, tabbed showcase' },
] as const;

type HomePageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function HomePage({ searchParams }: HomePageProps): Promise<ReactNode> {
  const caller = createCaller(await createContext());
  if (await caller.auth.signedIn().catch(() => false)) {
    redirect('/entries');
  }
  const requested = (await searchParams)['variant'];
  const variant = VARIANTS.find((v) => v.key === requested)?.key ?? 'A';

  return (
    <>
      {variant === 'A' && <VariantA chooseLanguage={chooseLanguage} />}
      {variant === 'B' && <VariantB chooseLanguage={chooseLanguage} />}
      {variant === 'C' && <VariantC chooseLanguage={chooseLanguage} />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </>
  );
}
