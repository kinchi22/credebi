import {
  assetsAndLiabilitiesQuerySchema,
  parseAssetsAndLiabilitiesQuery,
  type AssetsAndLiabilitiesOutput,
  type AssetsAndLiabilitiesQuery,
  type SearchQuery,
} from '@repo/contracts';
import { unanswered, type Unanswered } from './report-outcome';

export type ShowAssetsAndLiabilities = (
  asked: AssetsAndLiabilitiesQuery,
) => Promise<AssetsAndLiabilitiesOutput>;

export type ReportDate = Partial<AssetsAndLiabilitiesQuery>;

export type AssetsAndLiabilitiesAnswer =
  | {
      readonly outcome: 'answered';
      readonly asked: AssetsAndLiabilitiesQuery;
      readonly report: AssetsAndLiabilitiesOutput;
    }
  | { readonly outcome: Unanswered; readonly asked: ReportDate };

export async function answerAssetsAndLiabilities(
  show: ShowAssetsAndLiabilities,
  query: SearchQuery,
): Promise<AssetsAndLiabilitiesAnswer> {
  const asked = parseAssetsAndLiabilitiesQuery(query);
  if (!asked.ok) {
    return { outcome: 'refused', asked: {} };
  }

  try {
    return { outcome: 'answered', asked: asked.value, report: await show(asked.value) };
  } catch (thrown) {
    return { outcome: unanswered(thrown), asked: asked.value };
  }
}

export async function answerDefaultDayReport(
  show: ShowAssetsAndLiabilities,
  day: unknown,
): Promise<AssetsAndLiabilitiesAnswer> {
  const parsed = assetsAndLiabilitiesQuerySchema.safeParse(day);
  if (!parsed.success) {
    return { outcome: 'refused', asked: {} };
  }
  return answerAssetsAndLiabilities(show, parsed.data);
}
