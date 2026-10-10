import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  experimental: { proxyClientMaxBodySize: '10mb' },
};
export default config;
