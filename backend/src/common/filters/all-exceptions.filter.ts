import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    // --- Body-parser SyntaxError (e.g. invalid JSON like "not json") ---
    // NestJS maps Express body-parser SyntaxError -> BadRequestException(400)
    // via mapExternalException() in @nestjs/core (routes-resolver.js).
    // By the time the exception reaches this filter, it is already a
    // BadRequestException — the original SyntaxError is lost. We detect these
    // errors by their characteristic message pattern instead.
    //
    // These are typically external probes / scanners sending malformed bodies
    // to random endpoints (e.g. POST /api/predict with body "not json").
    // Log at debug level to avoid filling logs with scanner noise.
    const isBodyParserError =
      exception instanceof HttpException &&
      exception.getStatus() === HttpStatus.BAD_REQUEST &&
      /Unexpected token|valid JSON|Unexpected end/i.test(message);
    if (isBodyParserError) {
      this.logger.debug(`[${(request as any).id ?? 'anon'}] [Syntax] [${request.method}] ${request.url} - ${message}`);
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: message,
      });
      return;
    }

    // Log the full stack trace for 500 errors to help debugging HF Space issues
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`[${(request as any).id ?? 'anon'}] [${request.method}] ${request.url}`);
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    } else {
      this.logger.warn(`[${(request as any).id ?? 'anon'}] [${request.method}] ${request.url} - Status: ${status} - Message: ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    });
  }
}
