import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    // Correlation ID: accept from client, else generate. Propagated to logs
    // and the exception filter so a single request is traceable end-to-end.
    const reqId = (req.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID();
    (req as any).id = reqId;
    res.setHeader('x-request-id', reqId);

    const { method, originalUrl, ip } = req;
    const startTime = Date.now();
    this.logger.log(`[${reqId}] ${method} ${originalUrl} - IP: ${ip}`);
    // Capture logger into the closure: the res.send wrapper must NOT be
    // .bind(this)'d — Express invokes res.send with `this === res`, so binding
    // would rebind `this` to the middleware instance and break
    // `originalSend.call(this, body)` (→ "this.get is not a function").
    const logger = this.logger;

    const originalSend = res.send;
    res.send = function (body) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const line = `[${reqId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`;
      if (statusCode >= 400) logger.error(line);
      else logger.log(line);
      return originalSend.call(this, body);
    };

    next();
  }
}
