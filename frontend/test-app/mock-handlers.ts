import { mockSchools } from './mock-data/schools';
import { mockAuth } from './mock-data/auth';
import { mockCareer } from './mock-data/career';
import { mockAiChat } from './mock-data/ai-chat';
import { mockGamification } from './mock-data/gamification';
import { mockLibrary } from './mock-data/library';

export interface MockHandler {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  handler: (req: any) => any;
}

/**
 * EduMap Mock API — simulates the NestJS backend for local feature testing.
 * This file is NOT included in the Docker / Hugging Face deployment.
 */
export const mockHandlers: MockHandler[] = [
  // --- Map POIs ---
  {
    method: 'GET',
    path: '/api/map/locations',
    handler: () => ({
      data: mockSchools,
      total: mockSchools.length,
    }),
  },
  {
    method: 'GET',
    path: '/api/map/pois',
    handler: () => ({
      data: mockSchools,
      total: mockSchools.length,
    }),
  },
  {
    method: 'GET',
    path: '/api/map/stats',
    handler: () => ({
      data: {
        schools: mockSchools.filter((p) => p.category === 'school').length,
        libraries: mockSchools.filter((p) => p.category === 'library').length,
        wifi: mockSchools.filter((p) => p.category === 'wifi').length,
        total: mockSchools.length,
      },
    }),
  },

  // --- Auth ---
  {
    method: 'POST',
    path: '/api/auth/login',
    handler: (req: any) => {
      if (req.email === 'test@edumap.vn') {
        return {
          data: {
            access_token: 'mock-jwt-token',
            refresh_token: 'mock-refresh-token',
            ...mockAuth.user,
          },
        };
      }
      return { message: 'Invalid credentials' };
    },
  },
  {
    method: 'GET',
    path: '/api/auth/profile',
    handler: () => ({ data: mockAuth.user }),
  },
  {
    method: 'POST',
    path: '/api/auth/register',
    handler: (req: any) => ({
      data: { ...mockAuth.user, ...req },
    }),
  },

  // --- Career ---
  {
    method: 'GET',
    path: '/api/career/paths',
    handler: () => ({ data: mockCareer.paths }),
  },
  {
    method: 'GET',
    path: '/api/career/jobs',
    handler: () => ({ data: mockCareer.jobs }),
  },

  // --- AI Chat ---
  {
    method: 'POST',
    path: '/api/ai/chat',
    handler: (req: any) => ({
      data: mockAiChat.getResponse(req.message || ''),
    }),
  },
  {
    method: 'GET',
    path: '/api/ai/history',
    handler: () => ({ data: mockAiChat.history }),
  },

  // --- Analytics / Reporting ---
  {
    method: 'GET',
    path: '/api/analytics',
    handler: () => ({
      data: mockGamification.analytics,
    }),
  },
  {
    method: 'GET',
    path: '/api/gamification/leaderboard',
    handler: () => ({
      data: mockGamification.leaderboard,
    }),
  },
  {
    method: 'GET',
    path: '/api/dashboard/overview',
    handler: () => ({
      data: mockGamification.dashboardOverview,
    }),
  },

  // --- Library ---
  {
    method: 'GET',
    path: '/api/library/resources',
    handler: () => ({
      data: mockLibrary.resources,
    }),
  },
  {
    method: 'GET',
    path: '/api/library/search',
    handler: (req: any) => ({
      data: mockLibrary.search(req.query || ''),
    }),
  },
];

/**
 * Look up a mock handler for the given method + URL.
 */
export function findMockHandler(method: string, url: string): MockHandler | undefined {
  const normalized = url.split('?')[0].replace(/\/+$/, '') || '/';
  return mockHandlers.find(
    (h) =>
      h.method === method &&
      (h.path === normalized ||
        normalized.startsWith(h.path.replace('/:id', '')) ||
        normalized.match(new RegExp('^' + h.path.replace(/\/:[^/]+/g, '/[^/]+') + '$')))
  );
}
