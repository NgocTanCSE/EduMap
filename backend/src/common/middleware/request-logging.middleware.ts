import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');
    use(req: Request, res: Response, next: NextFunction) {
        const reqId = (req.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID();
        (req as any).id = reqId;
        res.setHeader('x-request-id', reqId);
        const { method, originalUrl, ip } = req;
        const startTime = Date.now();
        this.logger.log(`[${reqId}] ${method} ${originalUrl} - IP: ${ip}`);
        const logger = this.logger;
        const originalSend = res.send;
        res.send = function (body) {
            const duration = Date.now() - startTime;
            const statusCode = res.statusCode;
            const line = `[${reqId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`;
            if (statusCode >= 400)
                logger.error(line);
            else
                logger.log(line);
            return originalSend.call(this, body);
        };
        next();
    }
}
