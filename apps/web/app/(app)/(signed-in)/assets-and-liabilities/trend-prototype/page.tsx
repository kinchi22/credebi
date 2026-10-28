import { type ReactNode } from 'react';
import { PrototypeSwitcher } from '../../../../../components/prototype-switcher';
import { PAGE_HEADING } from '../../../../../components/text-classes';
import { VARIANTS, TrendVariant } from './variants';

export const dynamic = 'force-dynamic';

type PageProps = {
  readonly searchParams: Promise<{ variant?: string }>;
};

export default async function TrendPrototypePage({ searchParams }: PageProps): Promise<ReactNode> {
  const { variant = 'A' } = await searchParams;
  return (
    <>
      <h1 className={PAGE_HEADING}>Assets and liabilities trend (PROTOTYPE)</h1>
      <p className="text-body-dense text-text-muted">
        Throwaway: three Recharts 3 variants, switch with ?variant= or the bar below. Stub data, nothing is read or saved.
      </p>
      <TrendVariant variant={variant} />
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </>
  );
}
