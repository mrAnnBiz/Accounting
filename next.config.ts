import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize for Vercel deployment - exclude PDFs from function bundles only
  outputFileTracingExcludes: {
    // Only exclude from API routes to keep functions small
    '/api/**/*': [
      'public/papers/**/*',
    ],
    // Exclude unnecessary binary files for all routes  
    '*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
    ],
  },
  // Ensure static files are served correctly
  async headers() {
    return [
      {
        source: '/papers/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/pdf',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
