export function toggledSeries<Key extends string>(
  all: readonly Key[],
  shown: readonly Key[],
  key: Key,
): readonly Key[] {
  return all.filter((series) => (series === key) !== shown.includes(series));
}
