import { DEFAULT_LANGUAGE } from '@repo/contracts';
import { readFile } from 'node:fs/promises';
import { Logo } from '@repo/ui';
import { fontFaces, palette, semanticColors } from '@repo/ui/tokens';
import { getTranslations } from 'next-intl/server';
import { ImageResponse } from 'next/og';

const size = { width: 1200, height: 630 };

export async function generateImageMetadata(): Promise<
  readonly { readonly id: string; readonly alt: string; readonly size: typeof size; readonly contentType: string }[]
> {
  const t = await getTranslations({ locale: DEFAULT_LANGUAGE, namespace: 'app' });
  return [{ id: 'card', alt: t('name'), size, contentType: 'image/png' }];
}

const SANS_REGULAR = new URL('./fonts/IBMPlexSans-Regular.ttf', import.meta.url);

export default async function OpengraphImage(): Promise<ImageResponse> {
  const sans = await readFile(SANS_REGULAR);
  const t = await getTranslations({ locale: DEFAULT_LANGUAGE, namespace: 'app' });
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
        fontFamily: fontFaces.sans,
        fontSize: 40,
      }}
    >
      <Logo variant="horizontal" tone="reverse" name={t('name')} height={220} />
      <div>{t('description')}</div>
    </div>,
    { ...size, fonts: [{ name: fontFaces.sans, data: sans, weight: 400, style: 'normal' }] },
  );
}
