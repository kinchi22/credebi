import {
  assetsAndLiabilitiesTrendQuerySchema,
  parseAssetsAndLiabilitiesTrendQuery,
  type AssetsAndLiabilitiesTrendOutput,
  type AssetsAndLiabilitiesTrendQuery,
  type SearchQuery,
} from '@repo/contracts';
import { unanswered, type Unanswered } from './report-outcome';

export type ShowAssetsAndLiabilitiesTrend = (
  range: AssetsAndLiabilitiesTrendQuery,
) => Promise<AssetsAndLiabilitiesTrendOutput>;

export type TrendRange = Partial<AssetsAndLiabilitiesTrendQuery>;

export type AssetsAndLiabilitiesTrendAnswer =
  | {
      readonly outcome: 'answered';
      readonly range: AssetsAndLiabilitiesTrendQuery;
      readonly trend: AssetsAndLiabilitiesTrendOutput;
    }
  | { readonly outcome: Unanswered; readonly range: TrendRange };

export async function answerAssetsAndLiabilitiesTrend(
  show: ShowAssetsAndLiabilitiesTrend,
  query: SearchQuery,
): Promise<AssetsAndLiabilitiesTrendAnswer> {
  const range = parseAssetsAndLiabilitiesTrendQuery(query);
  if (!range.ok) {
    return { outcome: 'refused', range: {} };
  }

  try {
    return { outcome: 'answered', range: range.value, trend: await show(range.value) };
  } catch (thrown) {
    return { outcome: unanswered(thrown), range: range.value };
  }
}

export async function answerDefaultTrendRange(
  show: ShowAssetsAndLiabilitiesTrend,
  range: unknown,
): Promise<AssetsAndLiabilitiesTrendAnswer> {
  const parsed = assetsAndLiabilitiesTrendQuerySchema.safeParse(range);
  if (!parsed.success) {
    return { outcome: 'refused', range: {} };
  }
  return answerAssetsAndLiabilitiesTrend(show, parsed.data);
}
