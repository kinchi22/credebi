import { DEFAULT_LANGUAGE, languageSchema, type Language } from '@repo/contracts';
import { resolveLanguage, type LanguageSources } from '@repo/core/settings';
import { getRequestConfig, getTranslations, type RequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { type en } from '../messages/en';
import { CATALOGUES } from './catalogues';
import { LANGUAGE_COOKIE } from './language-cookie';

export const configForLanguage = (language: Language): RequestConfig => ({
  locale: language,
  messages: CATALOGUES[language] as typeof en,
});

export const requestConfig = (sources: LanguageSources): RequestConfig =>
  configForLanguage(resolveLanguage(sources));

export const getPrerenderedAppCopy = (): ReturnType<typeof getTranslations<'app'>> =>
  getTranslations({ locale: DEFAULT_LANGUAGE, namespace: 'app' });

async function requestSources(): Promise<LanguageSources> {
  const cookie = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  if (languageSchema.safeParse(cookie).success) {
    return { cookie };
  }
  return { cookie, acceptLanguage: (await headers()).get('accept-language') };
}

export const requestLanguage = async (): Promise<Language> =>
  resolveLanguage(await requestSources());

export default getRequestConfig(async ({ locale }) =>
  locale === undefined ? requestConfig(await requestSources()) : configForLanguage(locale),
);

declare module 'next-intl' {
  interface AppConfig {
    Locale: Language;
    Messages: typeof en;
  }
}
