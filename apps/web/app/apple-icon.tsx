import { getTranslations } from 'next-intl/server';
import { type ImageResponse } from 'next/og';
import { appIcon } from '../components/app-icon';

const SIZE = 180;

export const size = { width: SIZE, height: SIZE };

export const contentType = 'image/png';

export default async function AppleIcon(): Promise<ImageResponse> {
  const t = await getTranslations('app');
  return appIcon({ size: SIZE, maskable: false }, t('name'));
}
