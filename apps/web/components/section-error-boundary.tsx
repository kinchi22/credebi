'use client';

import { catchError, type ErrorInfo } from 'next/error';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { BUTTON, LEGEND, SETTINGS_SECTION } from './control-classes';
import { DANGER_TEXT } from './text-classes';

export type SectionFailureProps = { readonly name: string; readonly retry: () => void };

export function SectionFailure({ name, retry }: SectionFailureProps): ReactNode {
  const t = useTranslations();
  return (
    <div role="alert" className={`${SETTINGS_SECTION} items-start`}>
      <h3 className={LEGEND}>{name}</h3>
      <p className={DANGER_TEXT}>{t('sectionState.unavailable')}</p>
      <button type="button" onClick={retry} className={BUTTON}>
        {t('sectionState.tryAgain')}
      </button>
    </div>
  );
}

function SectionFailed({ name }: { readonly name: string }, { retry }: ErrorInfo): ReactNode {
  return <SectionFailure name={name} retry={retry} />;
}

export const SectionErrorBoundary = catchError(SectionFailed);
