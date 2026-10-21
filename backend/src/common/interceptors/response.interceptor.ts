import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Skip wrapping if the response is already a normalized API envelope.
        // A response that carries `success` (with or without a `data` key) is
        // treated as already-formatted — this prevents DOUBLE-WRAP bugs where a
        // controller returns `{ success, notifications }` (no `data`) and the
        // interceptor would else re-nest it as `{ success, data: { success, ... } }`.
        if (data !== null && typeof data === 'object' && 'success' in data) {
          return data;
        }
        // Skip wrapping for binary/stream responses (file downloads)
        const ctx = context.switchToHttp();
        const res = ctx.getResponse();
        if (res && typeof res.writeHead === 'function' && !res.writableEnded && res.get('Content-Type')?.includes('application/pdf')) {
          return data;
        }
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
