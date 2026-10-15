import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * Helper: create a fully-configured Nest app identical to production.
 * - Sets the `/api` global prefix
 * - Registers the global ValidationPipe (whitelist + forbidNonWhitelisted)
 * - Registers the ResponseInterceptor for consistent `{ success, data }` shape
 * - Registers the AllExceptionsFilter
 */
async function createApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.init();
  return app;
}

describe('Auth API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/api/auth/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          full_name: 'Test User',
          role: 'student',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('userId');
          expect(res.body.data.email).toBe('test@example.com');
        });
    });

    it('should return 400 for invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          full_name: 'Test User',
          role: 'student',
        })
        .expect(400);
    });
  });

  describe('/api/auth/login (POST)', () => {
    it('should login with valid credentials', async () => {
      // First register a user
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'login-test@example.com',
          password: 'password123',
          full_name: 'Login Test User',
          role: 'student',
        });

      // Then login — controller uses @HttpCode(OK) so 200, not 201
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'password123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('access_token');
        });
    });

    it('should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });
});

describe('Map API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/api/map/pois (GET)', () => {
    it('should return list of POIs', () => {
      return request(app.getHttpServer())
        .get('/api/map/pois')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('/api/map/categories (GET)', () => {
    it('should return list of categories', () => {
      return request(app.getHttpServer())
        .get('/api/map/categories')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });
});

describe('Career API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/api/career/paths (GET)', () => {
    it('should return list of career paths', () => {
      return request(app.getHttpServer())
        .get('/api/career/paths')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('/api/career/jobs (GET)', () => {
    it('should return list of Jobs', () => {
      return request(app.getHttpServer())
        .get('/api/career/jobs')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('jobs');
          expect(Array.isArray(res.body.data.jobs)).toBe(true);
        });
    });
  });
});

describe('Community API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/api/community/posts (GET)', () => {
    it('should return list of posts', () => {
      return request(app.getHttpServer())
        .get('/api/community/posts')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('posts');
          expect(Array.isArray(res.body.data.posts)).toBe(true);
        });
    });
  });
});

describe('Events API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/api/events (GET)', () => {
    it('should return list of events', () => {
      return request(app.getHttpServer())
        .get('/api/events')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });
});

describe('Library API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/api/library/resources (GET)', () => {
    it('should return list of resources', () => {
      return request(app.getHttpServer())
        .get('/api/library/resources')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('items');
          expect(Array.isArray(res.body.data.items)).toBe(true);
        });
    });
  });
});

describe('Scholarships API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/api/scholarships (GET)', () => {
    it('should return list of scholarships', () => {
      return request(app.getHttpServer())
        .get('/api/scholarships')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('items');
          expect(Array.isArray(res.body.data.items)).toBe(true);
        });
    });
  });
});
