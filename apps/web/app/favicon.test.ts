import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { CLEAR_SPACE, drawLogo, type LogoPartName } from '@repo/ui/logo-drawing';
import { palette, semanticColors } from '@repo/ui/tokens';
import { describe, expect, it } from 'vitest';

const favicon = readFileSync(new URL('./favicon.ico', import.meta.url));

type Image = { readonly size: number; readonly png: Buffer; readonly rows: Buffer };

const idat = (png: Buffer): Buffer => {
  const chunks: Buffer[] = [];
  for (let at = 8; at < png.length; at += 12 + png.readUInt32BE(at)) {
    if (png.toString('latin1', at + 4, at + 8) === 'IDAT') {
      chunks.push(png.subarray(at + 8, at + 8 + png.readUInt32BE(at)));
    }
  }
  return inflateSync(Buffer.concat(chunks));
};

const images = (ico: Buffer): readonly Image[] =>
  Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + 16 * index;
    const offset = ico.readUInt32LE(entry + 12);
    const png = ico.subarray(offset, offset + ico.readUInt32LE(entry + 8));
    return { size: ico.readUInt8(entry), png, rows: idat(png) };
  });

const RGBA_8_BIT = { depth: 8, colourType: 6, interlace: 0 };

const header = (png: Buffer) => ({
  depth: png.readUInt8(24),
  colourType: png.readUInt8(25),
  interlace: png.readUInt8(28),
});

const hex = (bytes: Buffer): string =>
  `#${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

const mark = drawLogo('mark', 'color');
const side = Math.max(mark.viewBox.maxX - mark.viewBox.minX, mark.viewBox.maxY - mark.viewBox.minY);
const centre = {
  x: (mark.viewBox.minX + mark.viewBox.maxX) / 2,
  y: (mark.viewBox.minY + mark.viewBox.maxY) / 2,
};

const part = (name: LogoPartName) => mark.parts.find((candidate) => candidate.name === name);

function pixel(image: Image, x: number, y: number): { readonly colour: string; readonly alpha: number } {
  const column = Math.floor(((x - centre.x + side / 2) / side) * image.size);
  const row = Math.floor(((y - centre.y + side / 2) / side) * image.size);
  const start = row * (1 + 4 * image.size);
  expect(image.rows.readUInt8(start)).toBe(0);
  const at = start + 1 + 4 * column;
  return { colour: hex(image.rows.subarray(at, at + 3)), alpha: image.rows.readUInt8(at + 3) };
}

describe('the favicon', () => {
  it('holds 16 and 32 pixel PNGs, each of the size its entry states, in 8-bit RGBA', () => {
    const found = images(favicon);
    expect(found.map((image) => image.size)).toEqual([16, 32]);
    for (const image of found) {
      expect(image.png.readUInt32BE(16)).toBe(image.size);
      expect(image.png.readUInt32BE(20)).toBe(image.size);
      expect(header(image.png)).toEqual(RGBA_8_BIT);
    }
  });

  it('draws each half of the Mark where the Logo puts it, in its colour-tone fill', () => {
    const left = part('left-half');
    const right = part('right-half');
    const [, large] = images(favicon);
    if (left === undefined || right === undefined || large === undefined) {
      throw new Error('the Mark or the 32 pixel favicon is missing');
    }

    const ring = pixel(large, left.bounds.minX + CLEAR_SPACE / 2, (left.bounds.minY + left.bounds.maxY) / 2);
    const disc = pixel(large, (right.bounds.minX + right.bounds.maxX) / 2, (right.bounds.minY + right.bounds.maxY) / 2);

    expect(ring).toEqual({ colour: palette[semanticColors[left.fill]], alpha: 255 });
    expect(disc).toEqual({ colour: palette[semanticColors[right.fill]], alpha: 255 });
  });

  it('leaves the clear space around the Mark transparent', () => {
    for (const image of images(favicon)) {
      expect(pixel(image, mark.viewBox.minX, mark.viewBox.minY).alpha).toBe(0);
    }
  });
});
