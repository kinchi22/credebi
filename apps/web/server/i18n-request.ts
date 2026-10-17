import { DEFAULT_LANGUAGE, type Language } from '@repo/contracts';
import { resolveLanguage, type LanguageSources } from '@repo/core/settings';
import { getRequestConfig, getTranslations } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { type en } from '../messages/en';
import { LANGUAGE_COOKIE } from './language-cookie';
import { configForRequest } from './request-config';

export const getPrerenderedAppCopy = (): ReturnType<typeof getTranslations<'app'>> =>
  getTranslations({ locale: DEFAULT_LANGUAGE, namespace: 'app' });

const requestSources = async (): Promise<LanguageSources> => ({
  cookie: (await cookies()).get(LANGUAGE_COOKIE)?.value,
  acceptLanguage: (await headers()).get('accept-language'),
});

export const requestLanguage = async (): Promise<Language> =>
  resolveLanguage(await requestSources());

export default getRequestConfig(({ locale }) => configForRequest(locale, requestSources));

declare module 'next-intl' {
  interface AppConfig {
    Locale: Language;
    Messages: typeof en;
  }
}
