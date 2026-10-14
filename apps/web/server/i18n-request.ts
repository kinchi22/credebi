import { languageSchema, type Language } from '@repo/contracts';
import { resolveLanguage, type LanguageSources } from '@repo/core/settings';
import { getRequestConfig, type RequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { en, type Catalogue } from '../messages/en';
import { ja } from '../messages/ja';
import { ko } from '../messages/ko';
import { LANGUAGE_COOKIE } from './language-cookie';

const CATALOGUES: Readonly<Record<Language, Catalogue>> = { en, ko, ja };

export const configIn = (language: Language): RequestConfig => ({
  locale: language,
  messages: CATALOGUES[language] as typeof en,
});

export const requestConfig = (sources: LanguageSources): RequestConfig =>
  configIn(resolveLanguage(sources));

async function requestSources(): Promise<LanguageSources> {
  const cookie = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  if (languageSchema.safeParse(cookie).success) {
    return { cookie };
  }
  return { cookie, acceptLanguage: (await headers()).get('accept-language') };
}

export default getRequestConfig(async ({ locale }) =>
  locale === undefined ? requestConfig(await requestSources()) : configIn(locale),
);

declare module 'next-intl' {
  interface AppConfig {
    Locale: Language;
    Messages: typeof en;
  }
}
