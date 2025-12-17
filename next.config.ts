import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      // Signed upload URLs, e.g. /api/uploads/19/file?teamId=...&exp=...&sig=...
      {
        pathname: '/api/uploads/**/file',
      },
      {
        pathname: '/api/variant-images/**/file',
      }
    ],
    // Allow any remote HTTPS image (stored URLs, CDN images, etc.)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    ppr: true,
    clientSegmentCache: true
  }
};

export default nextConfig;
