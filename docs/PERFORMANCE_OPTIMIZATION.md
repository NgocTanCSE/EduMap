# EduMap Performance Optimization Guide

## Tổng quan

Hướng dẫn tối ưu hiệu suất cho EduMap application.

## 1. Database Optimization

### 1.1 Query Optimization

```sql
-- Sử dụng EXPLAIN ANALYZE để phân tích query
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- Thêm index cho frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_map_points_location ON map_points USING GIST(location);

-- Sử dụng composite index cho multi-column queries
CREATE INDEX idx_events_status_date ON events(status, start_date);
```

### 1.2 Connection Pooling

```typescript
// backend/src/config/database.config.ts
export const databaseConfig = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ['dist/**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  extra: {
    max: 20, // Maximum number of connections
    min: 5,  // Minimum number of connections
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
};
```

### 1.3 N+1 Query Prevention

```typescript
// BAD: N+1 queries
const users = await this.userRepo.find();
for (const user of users) {
  user.posts = await this.postRepo.find({ where: { author_id: user.id } });
}

// GOOD: Join query
const users = await this.userRepo
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'post')
  .getMany();
```

## 2. Caching Strategy

### 2.1 Redis Caching

```typescript
// backend/src/common/cache/cache.service.ts
@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### 2.2 Application-Level Caching

```typescript
// Backend: Cache frequently accessed data
@Injectable()
export class CareerService {
  constructor(
    @InjectRepository(CareerPath)
    private readonly careerRepo: Repository<CareerPath>,
    private readonly cacheService: CacheService,
  ) {}

  async getCareerPaths(): Promise<CareerPath[]> {
    const cacheKey = 'career_paths';
    const cached = await this.cacheService.get<CareerPath[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const paths = await this.careerRepo.find();
    await this.cacheService.set(cacheKey, paths, 3600); // Cache for 1 hour
    
    return paths;
  }
}
```

### 2.3 Frontend Caching

```typescript
// frontend/lib/api.ts
const apiCache = new Map();

export async function fetchWithCache<T>(
  url: string,
  options?: RequestInit,
  ttl: number = 60000
): Promise<T> {
  const cacheKey = `${url}-${JSON.stringify(options)}`;
  
  if (apiCache.has(cacheKey)) {
    const cached = apiCache.get(cacheKey);
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }

  const response = await fetch(url, options);
  const data = await response.json();
  
  apiCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
  
  return data;
}
```

## 3. API Optimization

### 3.1 Pagination

```typescript
// Backend: Implement cursor-based pagination
@Injectable()
export class CommunityService {
  async getPosts(cursor?: string, limit: number = 20): Promise<Post[]> {
    const query = this.postRepo.createQueryBuilder('post')
      .orderBy('post.created_at', 'DESC')
      .take(limit);

    if (cursor) {
      query.where('post.created_at < :cursor', { cursor });
    }

    return query.getMany();
  }
}
```

### 3.2 Field Selection

```typescript
// Backend: Select only needed fields
async getUserProfile(userId: string) {
  return this.userRepo
    .createQueryBuilder('user')
    .select([
      'user.id',
      'user.email',
      'user.full_name',
      'user.avatar_url',
      'user.level',
      'user.points',
    ])
    .where('user.id = :userId', { userId })
    .getOne();
}
```

### 3.3 Response Compression

```typescript
// backend/src/main.ts
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable compression
  app.use(compression());
  
  // ... other configurations
}
```

## 4. Frontend Optimization

### 4.1 Image Optimization

```tsx
// frontend/components/OptimizedImage.tsx
import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
}: OptimizedImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      placeholder="blur"
      blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    />
  );
}
```

### 4.2 Code Splitting

```tsx
// frontend/app/dashboard/page.tsx
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false,
});

export default function DashboardPage() {
  return (
    <div>
      <HeavyComponent />
    </div>
  );
}
```

### 4.3 Lazy Loading

```tsx
// frontend/components/LazyList.tsx
import { useState, useEffect, useRef } from 'react';

interface LazyListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export default function LazyList<T>({
  items,
  renderItem,
  loadMore,
  hasMore,
}: LazyListProps<T>) {
  const [loading, setLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver>();
  const lastItemRef = useRef<HTMLDivElement>();

  useEffect(() => {
    if (loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setLoading(true);
          loadMore().then(() => setLoading(false));
        }
      },
      { threshold: 0.1 }
    );

    if (lastItemRef.current) {
      observerRef.current.observe(lastItemRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [loading, hasMore, loadMore]);

  return (
    <div>
      {items.map((item, index) => (
        <div
          key={index}
          ref={index === items.length - 1 ? lastItemRef : undefined}
        >
          {renderItem(item)}
        </div>
      ))}
      {loading && <div>Loading...</div>}
    </div>
  );
}
```

## 5. AI Service Optimization

### 5.1 Response Caching

```python
# ai-service/services/cache_service.py
class CacheService:
    def __init__(self):
        self.cache = {}
        self.ttl = {}

    def get(self, key: str):
        if key in self.cache:
            if time.time() < self.ttl.get(key, 0):
                return self.cache[key]
            else:
                del self.cache[key]
                del self.ttl[key]
        return None

    def set(self, key: str, value: any, ttl: int = 3600):
        self.cache[key] = value
        self.ttl[key] = time.time() + ttl
```

### 5.2 Batch Processing

```python
# ai-service/services/batch_service.py
class BatchService:
    async def process_batch(self, items: List[dict]):
        # Process items in batches of 100
        batch_size = 100
        results = []
        
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            batch_results = await self._process_batch(batch)
            results.extend(batch_results)
        
        return results
```

## 6. Monitoring and Profiling

### 6.1 Performance Metrics

```typescript
// backend/src/common/interceptors/performance.interceptor.ts
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        console.log(`Request took ${duration}ms`);
        
        // Send to monitoring service
        metrics.recordRequestDuration(duration);
      })
    );
  }
}
```

### 6.2 Database Query Logging

```typescript
// backend/src/config/database.config.ts
export const databaseConfig = {
  logging: process.env.NODE_ENV === 'development',
  logger: 'advanced-console',
  // Log slow queries
  maxQueryExecutionTime: 1000, // 1 second
};
```

## 7. Deployment Optimization

### 7.1 Docker Optimization

```dockerfile
# Use multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main"]
```

### 7.2 CDN Configuration

```nginx
# nginx.conf
location /static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location /api/ {
    proxy_pass http://backend:3000;
    proxy_cache_valid 200 10m;
}
```

## 8. Checklist

- [ ] Database indexes cho frequently queried columns
- [ ] Connection pooling configured
- [ ] N+1 queries eliminated
- [ ] Redis caching implemented
- [ ] API response compression enabled
- [ ] Image optimization configured
- [ ] Code splitting implemented
- [ ] Lazy loading for heavy components
- [ ] AI response caching
- [ ] Performance monitoring in place
- [ ] Docker multi-stage build
- [ ] CDN configured for static assets
