import { readStdinLines } from './stdin-lines.ts';

export const LISTING_CAP = 3000;

export function isMarkdownOnly(files: readonly string[], changedFiles: number): boolean {
  return (
    files.length > 0 &&
    Number.isInteger(changedFiles) &&
    files.length >= changedFiles &&
    files.length < LISTING_CAP &&
    files.every((file) => file.endsWith('.md'))
  );
}

if (import.meta.main) {
  const argument = process.argv[2] ?? '';
  const changedFiles = /^\d+$/.test(argument) ? Number(argument) : Number.NaN;
  console.log(`markdown_only=${String(isMarkdownOnly(readStdinLines(), changedFiles))}`);
}
