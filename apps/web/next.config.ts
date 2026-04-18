import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@app/db', '@app/shared'],
  experimental: { serverActions: { bodySizeLimit: '600mb' } },
};
export default config;
