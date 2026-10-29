import { useTranslations } from 'next-intl';
import { monthOf, yearOf } from '@repo/core/entries';

export function useMonthLabel(): (month: string) => string {
  const t = useTranslations('datePresets');
  return (month) =>
    t('periodOfYear', {
      period: t('month', { month: monthOf(month) }),
      year: String(yearOf(month)).padStart(4, '0'),
    });
}
