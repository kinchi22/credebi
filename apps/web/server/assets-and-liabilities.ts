import {
  assetsAndLiabilitiesQuerySchema,
  parseAssetsAndLiabilitiesQuery,
  type AssetsAndLiabilitiesOutput,
  type AssetsAndLiabilitiesQuery,
  type SearchQuery,
} from '@repo/contracts';
import { unanswered, type Unanswered } from './report-outcome';

export type ShowAssetsAndLiabilities = (
  day: AssetsAndLiabilitiesQuery,
) => Promise<AssetsAndLiabilitiesOutput>;

export type ReportDay = Partial<AssetsAndLiabilitiesQuery>;

export type AssetsAndLiabilitiesAnswer =
  | {
      readonly outcome: 'answered';
      readonly day: AssetsAndLiabilitiesQuery;
      readonly report: AssetsAndLiabilitiesOutput;
    }
  | { readonly outcome: Unanswered; readonly day: ReportDay };

export async function answerAssetsAndLiabilities(
  show: ShowAssetsAndLiabilities,
  query: SearchQuery,
): Promise<AssetsAndLiabilitiesAnswer> {
  const day = parseAssetsAndLiabilitiesQuery(query);
  if (!day.ok) {
    return { outcome: 'refused', day: {} };
  }

  try {
    return { outcome: 'answered', day: day.value, report: await show(day.value) };
  } catch (thrown) {
    return { outcome: unanswered(thrown), day: day.value };
  }
}

export async function answerDefaultDayReport(
  show: ShowAssetsAndLiabilities,
  day: unknown,
): Promise<AssetsAndLiabilitiesAnswer> {
  const parsed = assetsAndLiabilitiesQuerySchema.safeParse(day);
  if (!parsed.success) {
    return { outcome: 'refused', day: {} };
  }
  return answerAssetsAndLiabilities(show, parsed.data);
}
