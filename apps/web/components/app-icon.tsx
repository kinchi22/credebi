import { Logo } from '@repo/ui';
import { palette, semanticColors } from '@repo/ui/tokens';
import { ImageResponse } from 'next/og';
import { en } from '../messages/en';

export const APP_ICONS = {
  '192': { size: 192, maskable: false },
  '512': { size: 512, maskable: false },
  'maskable-512': { size: 512, maskable: true },
} as const;

export type AppIconName = keyof typeof APP_ICONS;

export type AppIcon = { readonly size: number; readonly maskable: boolean };

const MASKABLE_SAFE_ZONE = 0.8;

const ICON_GROUND = palette[semanticColors['ground-dark']];

export function appIcon({ size, maskable }: AppIcon): ImageResponse {
  const height = maskable ? size * MASKABLE_SAFE_ZONE : size;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: ICON_GROUND,
      }}
    >
      <Logo variant="mark" tone="reverse" name={en.app.name} height={height} />
    </div>,
    { width: size, height: size },
  );
}
