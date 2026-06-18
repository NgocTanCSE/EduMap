import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Khởi tạo Sentry trước khi khởi tạo Nest App
  Sentry.init({
    dsn: process.env.SENTRY_DSN_BACKEND,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
  });

  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 🛡️ SECURITY: Helmet bảo mật HTTP Header
  app.use(helmet());
  app.enableCors();

  // 📝 GLOBAL PREFIX: Tất cả API bắt đầu bằng /api
  app.setGlobalPrefix('api');

  // 📝 VALIDATION: Tự động kiểm tra DTO
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // 🐛 EXCEPTION FILTER: Log full stack traces
  app.useGlobalFilters(new AllExceptionsFilter());

  // REDIS WEBSOCKET ADAPTER
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // 📖 SWAGGER: Cấu hình Tài liệu API
  const config = new DocumentBuilder()
    .setTitle('EduMap API Ecosystem')
    .setDescription(String.raw`
## EduMap - Nền tảng Bản đồ Giáo dục Thông minh

### Giới thiệu
EduMap là nền tảng giáo dục toàn diện kết hợp bản đồ địa lý, trí tuệ nhân tạo, và cộng đồng học tập.

### Tính năng chính
- **Bản đồ Giáo dục**: Tìm kiếm địa điểm giáo dục với PostGIS
- **AI Chatbot**: Trợ lý ảo sử dụng Gemini Pro và RAG
- **Career Development**: Lộ trình nghề nghiệp và gợi ý việc làm
- **Community**: Cộng đồng học tập và thảo luận
- **Mentoring**: Kết nối mentor và học viên
- **Gamification**: Hệ thống điểm và huy hiệu

### Authentication
Sử dụng JWT Bearer Token để xác thực. Lấy token từ endpoint \`\\\${auth/login}\`.

### Rate Limiting
- API công khai: 100 requests/phút
- API xác thực: 20 requests/phút
- API AI: 10 requests/phút
    `)
    .setVersion('2.0')
    .setContact('EduMap Team', 'https://edumap.vn', 'admin@edumap.vn')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Nhập JWT token từ endpoint /auth/login',
      },
      'access-token',
    )
    .addTag('Auth', 'Xác thực & Phân quyền - Đăng nhập, đăng ký, quản lý tài khoản')
    .addTag('Admin', 'Quản trị hệ thống - Quản lý người dùng, nội dung, thống kê')
    .addTag('Map', 'Bản đồ & PostGIS - Tìm kiếm, thêm, đánh giá địa điểm giáo dục')
    .addTag('Library', 'Kho học liệu - Tài liệu, sách, khóa học')
    .addTag('AI', 'Trí tuệ nhân tạo - Chatbot, gợi ý, phân tích')
    .addTag('Career', 'Phát triển nghề nghiệp - Lộ trình, việc làm, thực tập')
    .addTag('Community', 'Cộng đồng - Bài viết, bình luận, nhóm học tập')
    .addTag('Mentor', 'Mentoring - Kết nối mentor và học viên')
    .addTag('Events', 'Sự kiện - Workshop, hackathon, seminar')
    .addTag('Scholarships', 'Học bổng - Tìm kiếm và apply học bổng')
    .addTag('Green', 'Môi trường - Thử thách xanh, hoạt động bảo vệ môi trường')
    .addTag('Gamification', 'Trò chơi hóa - Điểm, huy hiệu, bảng xếp hạng')
    .addTag('Donations', 'Quyên góp - Chiến dịch và lịch sử quyên góp')
    .addTag('Certificates', 'Chứng chỉ - Cấp và xác minh chứng chỉ số')
    .addTag('Surveys', 'Khảo sát - Tạo và trả lời khảo sát')
    .addTag('Notifications', 'Thông báo - Quản lý thông báo')
    .addTag('Storage', 'Lưu trữ - Upload và quản lý file')
    .addTag('Business', 'Kết nối doanh nghiệp - Sản phẩm, dịch vụ, giao dịch')
    .addTag('Volunteer', 'Tình nguyện - Hoạt động tình nguyện')
    .addTag('STEM', 'STEM Labs - Phòng thí nghiệm STEM')
    .addTag('WiFi', 'WiFi công cộng - Tìm và báo cáo điểm WiFi')
    .addTag('Crawler', 'Crawler - Thu thập dữ liệu tự động')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  
  logger.log(`🚀 Server is running on: http://0.0.0.0:${port}`);
  logger.log(`📖 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
