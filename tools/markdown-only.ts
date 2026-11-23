import { readFileSync } from 'node:fs';

export function isMarkdownOnly(files: readonly string[]): boolean {
  return files.length > 0 && files.every((file) => file.endsWith('.md'));
}

if (import.meta.main) {
  const files = readFileSync(0, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  console.log(`markdown_only=${String(isMarkdownOnly(files))}`);
}
