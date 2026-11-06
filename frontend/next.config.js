const { withSentryConfig } = require("@sentry/nextjs/config");








const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,




    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
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
        urlPattern: /\/api\/(map|wifi|stem|library|career|scholarships)\
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
          networkTimeoutSeconds: 10,
        },
      },
      {


        urlPattern: /\/api\/offline\/tutor\
        handler: 'NetworkFirst',
        options: {
          cacheName: 'offline-tutor-cache',
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
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



  async redirects() {
    return [
      {
        source: '/dashboard/saved',
        destination: '/dashboard#da-luu',
        permanent: false,
      },
      {
        source: '/storage',
        destination: '/dashboard#luu-tru',
        permanent: false,
      },
      {
        source: '/certificates',
        destination: '/dashboard#chung-chi',
        permanent: false,
      },
      {
        source: '/notifications',
        destination: '/dashboard#thong-bao',
        permanent: false,
      },
      {
        source: '/marketplace/books',
        destination: '/marketplace?category=book',
        permanent: false,
      },
      { source: '/ai-agent', destination: '/map?tool=ai-agent', permanent: false },
      { source: '/voice-search', destination: '/map?tool=voice-search', permanent: false },
      { source: '/talk2map', destination: '/map', permanent: false },
      { source: '/climate-guardian', destination: '/map?tool=climate', permanent: false },
      { source: '/map/data-hunter', destination: '/map?tool=data-hunter', permanent: false },
      { source: '/map/gap-predictor', destination: '/map?tool=gap-predictor', permanent: false },
      { source: '/map/geo-vision', destination: '/map?tool=geo-vision', permanent: false },
      { source: '/map/resource-optimizer', destination: '/map?tool=resource-optimizer', permanent: false },
      { source: '/map/survey-planner', destination: '/map?tool=survey-planner', permanent: false },
      { source: '/analytics', destination: '/analytics/trends', permanent: false },
      { source: '/auth', destination: '/auth/login', permanent: false },
    ];
  },






  async rewrites() {



    const backendUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
    return [
      {







        source: '/api/:path((?!ai/chat|ai/chat-stream|ai/agent/chat|ai/agent/chat-stream|ai/history|ai/learning-path|ai/search|ai/analytics|ai/pdf-transcript|gamification|offline/tutor|offline/status|config$).*)',
        destination: `${backendUrl}/api/:path`,
      },
    ];
  },
};

const baseConfig = withPWA(nextConfig);






module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(
      baseConfig,
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
    )
  : baseConfig;
