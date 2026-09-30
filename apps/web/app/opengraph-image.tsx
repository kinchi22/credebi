import { Logo } from '@repo/ui';
import { palette, semanticColors } from '@repo/ui/tokens';
import { ImageResponse } from 'next/og';
import { APP_ICON_GROUND } from '../components/app-icon';
import { en } from '../messages/en';

export const alt = en.app.name;

export const size = { width: 1200, height: 630 };

export const contentType = 'image/png';

export default function OpengraphImage(): ImageResponse {
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
        background: APP_ICON_GROUND,
        color: palette[semanticColors['text-muted-on-dark']],
        fontSize: 40,
      }}
    >
      <Logo variant="horizontal" tone="reverse" name={en.app.name} height={220} />
      <div>{en.app.description}</div>
    </div>,
    size,
  );
}
