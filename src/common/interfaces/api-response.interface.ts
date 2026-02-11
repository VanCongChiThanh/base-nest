/**
 * Standard API Response interfaces
 * Define standard format for all API responses
 */

// Base response interface
export interface BaseResponse {
  success: boolean;
  statusCode: number;
  timestamp: string;
}

// Success response interface
export interface ApiSuccessResponse<T = unknown> extends BaseResponse {
  success: true;
  statusCode: number;
  data: T;
  message?: string;
  meta?: ResponseMeta;
}

// Error response interface
export interface ApiErrorResponse extends BaseResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string | string[];
  details?: unknown;
}

// Pagination meta
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// General response meta
export interface ResponseMeta {
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

// Union type for any API response
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
