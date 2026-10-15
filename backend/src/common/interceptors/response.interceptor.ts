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
        // Skip wrapping if the response is already in {success, data} format
        if (data !== null && typeof data === 'object' && 'success' in data && 'data' in data) {
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
