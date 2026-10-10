export type DesignTokens = {
  readonly colors: Readonly<Record<string, string>>;
  readonly typography: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly rounded: Readonly<Record<string, string>>;
};

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/u;
const ENTRY = /^( *)([\w-]+):\s*(.*)$/u;

const unquote = (value: string): string =>
  /^(["']).*\1$/u.test(value) ? value.slice(1, -1) : value;

const topLevelBlock = (frontMatter: string, key: string): readonly string[] => {
  const lines = frontMatter.split('\n');
  const start = lines.indexOf(`${key}:`);
  if (start === -1) {
    return [];
  }
  const end = lines.findIndex((line, index) => index > start && /^\S/u.test(line));
  return lines.slice(start + 1, end === -1 ? undefined : end);
};

const flatBlock = (frontMatter: string, key: string): Record<string, string> => {
  const entries: Record<string, string> = {};
  for (const line of topLevelBlock(frontMatter, key)) {
    const match = ENTRY.exec(line);
    if (match?.[2] !== undefined && match[3] !== undefined) {
      entries[match[2]] = unquote(match[3]);
    }
  }
  return entries;
};

export function readDesignTokens(document: string): DesignTokens {
  const frontMatter = FRONT_MATTER.exec(document)?.[1] ?? '';
  const colors = flatBlock(frontMatter, 'colors');
  const typography: Record<string, Record<string, string>> = {};
  let step: Record<string, string> | undefined;
  for (const line of topLevelBlock(frontMatter, 'typography')) {
    const match = ENTRY.exec(line);
    if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
      continue;
    }
    if (match[1].length === 2) {
      step = {};
      typography[match[2]] = step;
    } else if (step !== undefined) {
      step[match[2]] = unquote(match[3]);
    }
  }
  return { colors, typography, rounded: flatBlock(frontMatter, 'rounded') };
}
