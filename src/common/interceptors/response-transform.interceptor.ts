import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiSuccessResponse,
  PaginationMeta,
} from '../interfaces/api-response.interface';

/**
 * Response Transform Interceptor
 * Automatically wrap response into standard format for success cases
 */
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();
    const statusCode = response.statusCode || 200;

    return next.handle().pipe(
      map((responseData) => {
        // If response already has standard format (success field), return as-is
        if (
          responseData &&
          typeof responseData === 'object' &&
          'success' in responseData
        ) {
          return responseData;
        }

        // Handle response with message field only (like logout, register)
        if (
          responseData &&
          typeof responseData === 'object' &&
          'message' in responseData &&
          Object.keys(responseData).length === 1
        ) {
          return {
            success: true as const,
            statusCode,
            data: null,
            message: responseData.message,
            timestamp: new Date().toISOString(),
          };
        }

        // Handle paginated response
        if (this.isPaginatedResponse(responseData)) {
          const { data, total, page, limit, ...rest } = responseData;
          const totalPages = Math.ceil(total / limit);

          const paginationMeta: PaginationMeta = {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
          };

          return {
            success: true as const,
            statusCode,
            data,
            meta: {
              pagination: paginationMeta,
              ...rest,
            },
            timestamp: new Date().toISOString(),
          };
        }

        // Normal response
        return {
          success: true as const,
          statusCode,
          data: responseData,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  /**
   * Check if response is a paginated response
   */
  private isPaginatedResponse(data: unknown): data is {
    data: unknown[];
    total: number;
    page: number;
    limit: number;
    [key: string]: unknown;
  } {
    return (
      data !== null &&
      typeof data === 'object' &&
      'data' in data &&
      'total' in data &&
      'page' in data &&
      'limit' in data &&
      Array.isArray((data as Record<string, unknown>).data)
    );
  }
}
