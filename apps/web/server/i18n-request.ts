import { getRequestConfig, type RequestConfig } from 'next-intl/server';
import { en } from '../messages/en';

const CATALOGUES = { en } as const;

type Language = keyof typeof CATALOGUES;

const LANGUAGE: Language = 'en';

export const requestConfig = (): Promise<RequestConfig> =>
  Promise.resolve({ locale: LANGUAGE, messages: CATALOGUES[LANGUAGE] });

export default getRequestConfig(requestConfig);

declare module 'next-intl' {
  interface AppConfig {
    Locale: Language;
    Messages: typeof en;
  }
}
