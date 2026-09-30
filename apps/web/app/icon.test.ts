import { readFileSync } from 'node:fs';
import { drawLogo } from '@repo/ui/logo-drawing';
import { palette, semanticColors } from '@repo/ui/tokens';
import { describe, expect, it } from 'vitest';

const icon = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');

const VIEW_BOX = /<svg\b[^>]*\bviewBox="([^"]*)"/u;
const PATH = /<path d="([^"]*)" fill="([^"]*)"\/>/gu;

describe('the SVG icon', () => {
  const mark = drawLogo('mark', 'color');

  it('frames the Mark with its clear space, as the Logo does', () => {
    const { minX, minY, maxX, maxY } = mark.viewBox;
    expect(VIEW_BOX.exec(icon)?.[1]).toBe(
      [minX, minY, maxX - minX, maxY - minY].map(String).join(' '),
    );
  });

  it('draws the Mark in the colour tone, half by half', () => {
    expect([...icon.matchAll(PATH)].map(([, d, fill]) => ({ d, fill }))).toEqual(
      mark.parts.map((part) => ({ d: part.d, fill: palette[semanticColors[part.fill]] })),
    );
  });
});
