import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorDefinition } from '../constants';

/**
 * Custom Business Exception
 * Use this to throw errors with specific errorCode and message
 *
 * @example
 * throw new BusinessException(AUTH_ERRORS.AUTH_INVALID_CREDENTIALS);
 * throw new BusinessException(AUTH_ERRORS.AUTH_INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED);
 */
export class BusinessException extends HttpException {
  constructor(
    error: ErrorDefinition,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        code: error.code,
        message: error.message,
      },
      statusCode,
    );
  }
}

/**
 * Bad Request Exception - for general bad request errors
 */
export class BadRequestException extends BusinessException {
  constructor(error: ErrorDefinition) {
    super(error, HttpStatus.BAD_REQUEST);
  }
}

/**
 * Validation Exception - for validation errors
 */
export class ValidationException extends BusinessException {
  constructor(error: ErrorDefinition) {
    super(error, HttpStatus.BAD_REQUEST);
  }
}

/**
 * Unauthorized Exception - for authentication errors
 */
export class UnauthorizedException extends BusinessException {
  constructor(error: ErrorDefinition) {
    super(error, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * Forbidden Exception - for permission errors
 */
export class ForbiddenException extends BusinessException {
  constructor(error: ErrorDefinition) {
    super(error, HttpStatus.FORBIDDEN);
  }
}

/**
 * Not Found Exception - for resource not found errors
 */
export class NotFoundException extends BusinessException {
  constructor(error: ErrorDefinition) {
    super(error, HttpStatus.NOT_FOUND);
  }
}

/**
 * Conflict Exception - for resource conflict errors
 */
export class ConflictException extends BusinessException {
  constructor(error: ErrorDefinition) {
    super(error, HttpStatus.CONFLICT);
  }
}
