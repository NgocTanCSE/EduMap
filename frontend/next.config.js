const { withSentryConfig } = require("@sentry/nextjs");

// EduMap Frontend — single Next.js configuration.
//
// NOTE: Previously this project shipped TWO config files (`next.config.js` and
// `next.config.mjs`). Next.js loads only one of them, so one of the two sets of
// options (PWA/Sentry/images vs. rewrites) was silently ignored depending on
// which file Next.js picked. They are merged here into a single source of
// truth so the build is now deterministic.
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'leaflet-assets',
          expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /^https:\/\/(?:[a-c]\.basemaps\.cartocdn\.com|[a-c]\.tile\.openstreetmap\.org)\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'map-tiles',
          expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /\/api\/(map|wifi|stem|library|career|scholarships)\//i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif|ico)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-images',
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      }
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Reverse-proxy `/api/*` to the NestJS backend so the browser can call
  // `/api/auth/login`, `/api/map/...`, etc. The BFF route handlers in
  // `app/api/*` (notably `/api/ai/chat` and `/api/ai/history`) are kept
  // out of the loop on purpose: they run in Next and add error handling +
  // auth-token forwarding that a raw proxy would skip.
  async rewrites() {
    // `BACKEND_URL` is injected by Docker Compose (e.g. http://backend:3000).
    // The NestJS backend listens on `PORT || 3000` (backend/src/main.ts), so
    // 3000 — NOT 3001 — is the correct local-dev fallback.
    const backendUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
    return [
      {
        source: '/api/:path((?!ai/chat|ai/history).*)',
        destination: `${backendUrl}/api/:path`,
      },
    ];
  },
};

module.exports = withSentryConfig(
  withPWA(nextConfig),
  {
    silent: true,
    org: "edumap",
    project: "frontend",
  },
  {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    tunnelRoute: "/monitoring",
    hideSourceMaps: true,
    disableLogger: true,
  }
);
