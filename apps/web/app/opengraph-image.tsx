import { readFile } from 'node:fs/promises';
import { Logo } from '@repo/ui';
import { palette, semanticColors } from '@repo/ui/tokens';
import { ImageResponse } from 'next/og';
import { en } from '../messages/en';

export const alt = en.app.name;

export const size = { width: 1200, height: 630 };

export const contentType = 'image/png';

const SORA_REGULAR = new URL('./fonts/Sora-Regular.ttf', import.meta.url);

export default async function OpengraphImage(): Promise<ImageResponse> {
  const sora = await readFile(SORA_REGULAR);
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        width: '100%',
        height: '100%',
        background: palette[semanticColors['ground-dark']],
        color: palette[semanticColors['text-muted-on-dark']],
        fontFamily: 'Sora',
        fontSize: 40,
      }}
    >
      <Logo variant="horizontal" tone="reverse" name={en.app.name} height={220} />
      <div>{en.app.description}</div>
    </div>,
    { ...size, fonts: [{ name: 'Sora', data: sora, weight: 400, style: 'normal' }] },
  );
}
