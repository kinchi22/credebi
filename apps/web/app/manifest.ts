import { palette, semanticColors } from '@repo/ui/tokens';
import { type MetadataRoute } from 'next';
import { APP_ICONS } from '../components/app-icon';
import { getPrerenderedAppCopy } from '../server/i18n-request';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getPrerenderedAppCopy();
  return {
    name: t('name'),
    short_name: t('name'),
    description: t('description'),
    start_url: '/',
    display: 'standalone',
    background_color: palette[semanticColors.ground],
    theme_color: palette[semanticColors['ground-dark']],
    icons: Object.entries(APP_ICONS).map(([name, { size, maskable }]) => ({
      src: `/app-icon/${name}`,
      sizes: `${String(size)}x${String(size)}`,
      type: 'image/png',
      purpose: maskable ? 'maskable' : 'any',
    })),
  };
}
