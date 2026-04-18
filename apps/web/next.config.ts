import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@app/db', '@app/shared'],
  experimental: { serverActions: { bodySizeLimit: '600mb' } },
  webpack(webpackConfig) {
    // Allow webpack to resolve ESM `.js` extension imports to `.ts` source files
    // when transpiling monorepo packages (e.g. @app/shared uses NodeNext .js imports)
    webpackConfig.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    return webpackConfig;
  },
};
export default config;
