import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

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

  // 📖 SWAGGER: Cấu hình Tài liệu API
  const config = new DocumentBuilder()
    .setTitle('EduMap API Ecosystem')
    .setDescription('Hệ sinh thái API cho nền tảng Bản đồ Giáo dục Thông minh')
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('Auth', 'Xác thực & Phân quyền')
    .addTag('Map', 'Bản đồ & PostGIS')
    .addTag('Library', 'Kho học liệu')
    .addTag('AI', 'Trí tuệ nhân tạo')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  
  logger.log(`🚀 Server is running on: http://0.0.0.0:${port}`);
  logger.log(`📖 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
