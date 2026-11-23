import { readFileSync } from 'node:fs';

export function readStdinLines(): readonly string[] {
  return readFileSync(0, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
