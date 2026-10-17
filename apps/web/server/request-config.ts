import type { Language } from '@repo/contracts';
import { resolveLanguage, type LanguageSources } from '@repo/core/settings';
import type { RequestConfig } from 'next-intl/server';
import { type en } from '../messages/en';
import { CATALOGUES } from './catalogues';

export const configForLanguage = (language: Language): RequestConfig => ({
  locale: language,
  messages: CATALOGUES[language] as typeof en,
});

export const configForSources = (sources: LanguageSources): RequestConfig =>
  configForLanguage(resolveLanguage(sources));

export const configForRequest = async (
  locale: Language | undefined,
  sources: () => Promise<LanguageSources>,
): Promise<RequestConfig> =>
  locale === undefined ? configForSources(await sources()) : configForLanguage(locale);
