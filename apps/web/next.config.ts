import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  output: 'standalone',
  // Tell Next's file tracer to walk the whole monorepo so packages/db,
  // packages/shared, and their transitive deps (Prisma, Playwright, etc.)
  // get included in standalone output. Without this, server.js fails at
  // runtime with "Cannot find module @app/db" (or similar).
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
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
