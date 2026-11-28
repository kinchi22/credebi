'use client';

import { catchError, type ErrorInfo } from 'next/error';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { BUTTON, LEGEND } from './control-classes';
import { DANGER_TEXT } from './text-classes';

type SectionErrorProps = { readonly name: string };

function SectionFailed({ name }: SectionErrorProps, { retry }: ErrorInfo): ReactNode {
  const t = useTranslations();
  return (
    <div role="alert" className="flex flex-col items-start gap-2 border-b border-border py-5">
      <h3 className={LEGEND}>{name}</h3>
      <p className={DANGER_TEXT}>{t('sectionState.unavailable')}</p>
      <button type="button" onClick={retry} className={BUTTON}>
        {t('sectionState.tryAgain')}
      </button>
    </div>
  );
}

export const SectionErrorBoundary = catchError(SectionFailed);
