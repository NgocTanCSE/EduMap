import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger, } from '@nestjs/common';
import { Request, Response } from 'express';
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = exception instanceof HttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        const message = exception instanceof HttpException
            ? exception.message
            : 'Internal server error';
        const isBodyParserError = exception instanceof HttpException &&
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
        if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(`[${(request as any).id ?? 'anon'}] [${request.method}] ${request.url}`);
            this.logger.error(exception instanceof Error ? exception.stack : exception);
        }
        else {
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
