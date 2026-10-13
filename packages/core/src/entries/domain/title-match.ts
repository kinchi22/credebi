export const titleKey = (title: string): string => title.trim().toLowerCase();

export function titleMatching<Titled extends { readonly title: string }>(
  titles: readonly Titled[],
  typed: string,
): Titled | undefined {
  const key = titleKey(typed);
  return key === '' ? undefined : titles.find(({ title }) => titleKey(title) === key);
}
