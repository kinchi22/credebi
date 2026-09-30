import { type ImageResponse } from 'next/og';
import { appIcon } from '../components/app-icon';

const SIZE = 180;

export const size = { width: SIZE, height: SIZE };

export const contentType = 'image/png';

export default function AppleIcon(): ImageResponse {
  return appIcon(SIZE, false);
}
