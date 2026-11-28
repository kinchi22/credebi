import { type Page } from '@playwright/test';
import { chooseLanguageAtSettings, type Language } from './language';
import { TREND_PATH, withQuery } from './routes';

export const atRange = (from: string, to: string): ((url: URL) => boolean) =>
  withQuery(TREND_PATH, { from, to });

export async function useLanguage(page: Page, language: Language): Promise<void> {
  if (language !== 'en') await chooseLanguageAtSettings(page, language);
}
