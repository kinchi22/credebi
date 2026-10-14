import { type ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { APP_ICONS, appIcon, type AppIconName } from '../../../components/app-icon';
import { getPrerenderedAppCopy } from '../../../server/i18n-request';

const isAppIcon = (name: string): name is AppIconName => Object.hasOwn(APP_ICONS, name);

export const dynamicParams = false;

export function generateStaticParams(): readonly { readonly icon: string }[] {
  return Object.keys(APP_ICONS).map((icon) => ({ icon }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ icon: string }> },
): Promise<ImageResponse> {
  const { icon } = await params;
  if (!isAppIcon(icon)) {
    notFound();
  }
  const t = await getPrerenderedAppCopy();
  return appIcon(APP_ICONS[icon], t('name'));
}
