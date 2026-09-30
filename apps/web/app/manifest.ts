import { palette, semanticColors } from '@repo/ui/tokens';
import { type MetadataRoute } from 'next';
import { APP_ICON_GROUND, APP_ICONS } from '../components/app-icon';
import { en } from '../messages/en';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: en.app.name,
    short_name: en.app.name,
    description: en.app.description,
    start_url: '/',
    display: 'standalone',
    background_color: palette[semanticColors.ground],
    theme_color: APP_ICON_GROUND,
    icons: Object.entries(APP_ICONS).map(([name, { size, maskable }]) => ({
      src: `/app-icon/${name}`,
      sizes: `${String(size)}x${String(size)}`,
      type: 'image/png',
      purpose: maskable ? 'maskable' : 'any',
    })),
  };
}
