import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./server/i18n-request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/contracts', '@repo/core', '@repo/ui'],
  distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default withNextIntl(nextConfig);
