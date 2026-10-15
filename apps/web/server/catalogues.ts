import { type Language } from '@repo/contracts';
import { en, type Catalogue } from '../messages/en';
import { ja } from '../messages/ja';
import { ko } from '../messages/ko';

export const CATALOGUES: Readonly<Record<Language, Catalogue>> = { en, ko, ja };

export const startingAccountNames = (language: Language): Catalogue['startingAccounts'] =>
  CATALOGUES[language].startingAccounts;
