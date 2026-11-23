import { readStdinLines } from './stdin-lines.ts';

export function isMarkdownOnly(files: readonly string[]): boolean {
  return files.length > 0 && files.every((file) => file.endsWith('.md'));
}

if (import.meta.main) {
  console.log(`markdown_only=${String(isMarkdownOnly(readStdinLines()))}`);
}
