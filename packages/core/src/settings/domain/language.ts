import { DEFAULT_LANGUAGE, languageSchema, type Language } from '@repo/contracts';

export type LanguageSources = {
  readonly cookie?: string | undefined;
  readonly acceptLanguage?: string | null | undefined;
};

type Preference = { readonly language: string; readonly weight: number };

const LANGUAGE_RANGE = /^([a-z]{1,8})(?:-[a-z\d]{1,8})*$/iu;
const WEIGHT = /^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/iu;

function preferenceOf(entry: string): Preference | undefined {
  const [range = '', ...parameters] = entry.split(';').map((part) => part.trim());
  const primary = LANGUAGE_RANGE.exec(range)?.[1];
  if (primary === undefined) {
    return undefined;
  }
  const weights = parameters.filter((parameter) => /^q=/iu.test(parameter));
  if (weights.length === 0) {
    return { language: primary.toLowerCase(), weight: 1 };
  }
  const weight = WEIGHT.exec(weights[0] ?? '')?.[1];
  return weight === undefined ? undefined : { language: primary.toLowerCase(), weight: Number(weight) };
}

function fromAcceptLanguage(header: string): Language | undefined {
  const preferred = header
    .split(',')
    .map(preferenceOf)
    .filter((preference): preference is Preference => preference !== undefined && preference.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  for (const { language } of preferred) {
    const parsed = languageSchema.safeParse(language);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return undefined;
}

export function resolveLanguage({ cookie, acceptLanguage }: LanguageSources): Language {
  const chosen = languageSchema.safeParse(cookie);
  if (chosen.success) {
    return chosen.data;
  }
  return fromAcceptLanguage(acceptLanguage ?? '') ?? DEFAULT_LANGUAGE;
}
