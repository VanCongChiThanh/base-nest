import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-response.interface';

/**
 * Global exception filter to handle all exceptions
 * Format error response consistently for all APIs
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: string | string[];
    let errorCode: string;
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;

        // Get message from response
        message =
          (responseObj.message as string | string[]) || exception.message;

        // Get errorCode from response (service should provide this)
        // If not provided, use a generic code based on status
        errorCode = (responseObj.code as string) || 'SYSTEM_UNKNOWN_ERROR';

        // Capture validation errors details
        if (status === 400 && Array.isArray(message)) {
          errorCode = 'VALIDATION_FAILED';
          details = { validationErrors: message };
        }
      } else {
        message = exception.message;
        errorCode = 'SYSTEM_UNKNOWN_ERROR';
      }
    } else {
      // Unexpected error - log details, return generic message
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      errorCode = 'SYSTEM_INTERNAL_ERROR';

      this.logger.error(
        `Unexpected error: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode: status,
      errorCode: errorCode,
      message,
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {}),
    };

    response.status(status).json(errorResponse);
  }
}
