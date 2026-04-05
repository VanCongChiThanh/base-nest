/**
 * Error Code Constants
 * Format: DOMAIN_ACTION_REASON or DOMAIN_REASON
 *
 * Each module/service defines its own error codes here
 * errorCode is independent from HTTP statusCode
 */

// Helper type for error definition
export interface ErrorDefinition {
  readonly code: string;
  readonly message: string;
}

// ==================== AUTH ====================
export const AUTH_ERRORS = {
  AUTH_INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Email or password is incorrect',
  },
  AUTH_TOKEN_EXPIRED: {
    code: 'AUTH_TOKEN_EXPIRED',
    message: 'Token has expired',
  },
  AUTH_TOKEN_INVALID: {
    code: 'AUTH_TOKEN_INVALID',
    message: 'Token is invalid',
  },
  AUTH_REFRESH_TOKEN_EXPIRED: {
    code: 'AUTH_REFRESH_TOKEN_EXPIRED',
    message: 'Refresh token has expired',
  },
  AUTH_INVALID_REFRESH_TOKEN: {
    code: 'AUTH_INVALID_REFRESH_TOKEN',
    message: 'Refresh token is invalid',
  },
  AUTH_INVALID_VERIFICATION_TOKEN: {
    code: 'AUTH_INVALID_VERIFICATION_TOKEN',
    message: 'Verification token is invalid or has expired',
  },
  AUTH_INVALID_RESET_TOKEN: {
    code: 'AUTH_INVALID_RESET_TOKEN',
    message: 'Reset password token is invalid or has expired',
  },
  AUTH_LOGIN_FAILED: {
    code: 'AUTH_LOGIN_FAILED',
    message: 'Login failed',
  },
  AUTH_ACCOUNT_LOCKED: {
    code: 'AUTH_ACCOUNT_LOCKED',
    message: 'Account has been locked',
  },
  AUTH_ACCOUNT_NOT_VERIFIED: {
    code: 'AUTH_ACCOUNT_NOT_VERIFIED',
    message: 'Account has not been verified',
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    code: 'AUTH_EMAIL_NOT_VERIFIED',
    message: 'Email has not been verified',
  },
  AUTH_LOGOUT_FAILED: {
    code: 'AUTH_LOGOUT_FAILED',
    message: 'Logout failed',
  },
} as const;

// ==================== USER ====================
export const USER_ERRORS = {
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'User not found',
  },
  USER_EMAIL_EXISTS: {
    code: 'USER_EMAIL_EXISTS',
    message: 'Email already exists',
  },
  USER_PHONE_EXISTS: {
    code: 'USER_PHONE_EXISTS',
    message: 'Phone number already exists',
  },
  USER_CREATE_FAILED: {
    code: 'USER_CREATE_FAILED',
    message: 'Failed to create user',
  },
  USER_UPDATE_FAILED: {
    code: 'USER_UPDATE_FAILED',
    message: 'Failed to update user',
  },
  USER_DELETE_FAILED: {
    code: 'USER_DELETE_FAILED',
    message: 'Failed to delete user',
  },
  USER_UPDATE_FORBIDDEN: {
    code: 'USER_UPDATE_FORBIDDEN',
    message: 'You are not allowed to update this user',
  },
  USER_DELETE_FORBIDDEN: {
    code: 'USER_DELETE_FORBIDDEN',
    message: 'You are not allowed to delete this user',
  },
} as const;

// ==================== PERMISSION ====================
export const PERMISSION_ERRORS = {
  PERMISSION_FORBIDDEN: {
    code: 'PERMISSION_FORBIDDEN',
    message: 'You do not have permission to perform this action',
  },
  PERMISSION_ROLE_REQUIRED: {
    code: 'PERMISSION_ROLE_REQUIRED',
    message: 'Required role not found',
  },
  PERMISSION_ACCESS_DENIED: {
    code: 'PERMISSION_ACCESS_DENIED',
    message: 'Access denied',
  },
} as const;

// ==================== VALIDATION ====================
export const VALIDATION_ERRORS = {
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
  },
  VALIDATION_EMAIL_INVALID: {
    code: 'VALIDATION_EMAIL_INVALID',
    message: 'Email format is invalid',
  },
  VALIDATION_PASSWORD_TOO_SHORT: {
    code: 'VALIDATION_PASSWORD_TOO_SHORT',
    message: 'Password is too short',
  },
  VALIDATION_PASSWORD_TOO_WEAK: {
    code: 'VALIDATION_PASSWORD_TOO_WEAK',
    message: 'Password is too weak',
  },
  VALIDATION_REQUIRED_FIELD_MISSING: {
    code: 'VALIDATION_REQUIRED_FIELD_MISSING',
    message: 'Required field is missing',
  },
  VALIDATION_INVALID_FORMAT: {
    code: 'VALIDATION_INVALID_FORMAT',
    message: 'Invalid format',
  },
} as const;

// ==================== RESOURCE ====================
export const RESOURCE_ERRORS = {
  RESOURCE_NOT_FOUND: {
    code: 'RESOURCE_NOT_FOUND',
    message: 'Resource not found',
  },
  RESOURCE_ALREADY_EXISTS: {
    code: 'RESOURCE_ALREADY_EXISTS',
    message: 'Resource already exists',
  },
  RESOURCE_CONFLICT: {
    code: 'RESOURCE_CONFLICT',
    message: 'Resource conflict',
  },
  RESOURCE_CREATE_FAILED: {
    code: 'RESOURCE_CREATE_FAILED',
    message: 'Failed to create resource',
  },
  RESOURCE_UPDATE_FAILED: {
    code: 'RESOURCE_UPDATE_FAILED',
    message: 'Failed to update resource',
  },
  RESOURCE_DELETE_FAILED: {
    code: 'RESOURCE_DELETE_FAILED',
    message: 'Failed to delete resource',
  },
} as const;

// ==================== NOTIFICATION ====================
export const NOTIFICATION_ERRORS = {
  NOTIFICATION_NOT_FOUND: {
    code: 'NOTIFICATION_NOT_FOUND',
    message: 'Notification not found',
  },
  NOTIFICATION_SEND_FAILED: {
    code: 'NOTIFICATION_SEND_FAILED',
    message: 'Failed to send notification',
  },
  NOTIFICATION_UPDATE_FAILED: {
    code: 'NOTIFICATION_UPDATE_FAILED',
    message: 'Failed to update notification',
  },
  NOTIFICATION_DELETE_FAILED: {
    code: 'NOTIFICATION_DELETE_FAILED',
    message: 'Failed to delete notification',
  },
  NOTIFICATION_ACCESS_FORBIDDEN: {
    code: 'NOTIFICATION_ACCESS_FORBIDDEN',
    message: 'You are not allowed to access this notification',
  },
} as const;

// ==================== UPLOAD ====================
export const UPLOAD_ERRORS = {
  UPLOAD_FAILED: {
    code: 'UPLOAD_FAILED',
    message: 'File upload failed',
  },
  UPLOAD_FILE_TOO_LARGE: {
    code: 'UPLOAD_FILE_TOO_LARGE',
    message: 'File size exceeds limit',
  },
  UPLOAD_INVALID_FILE_TYPE: {
    code: 'UPLOAD_INVALID_FILE_TYPE',
    message: 'File type is not allowed',
  },
  UPLOAD_PRESIGNED_URL_FAILED: {
    code: 'UPLOAD_PRESIGNED_URL_FAILED',
    message: 'Failed to generate presigned URL',
  },
} as const;

// ==================== MAIL ====================
export const MAIL_ERRORS = {
  MAIL_SEND_FAILED: {
    code: 'MAIL_SEND_FAILED',
    message: 'Failed to send email',
  },
  MAIL_TEMPLATE_NOT_FOUND: {
    code: 'MAIL_TEMPLATE_NOT_FOUND',
    message: 'Email template not found',
  },
} as const;

// ==================== SYSTEM ====================
export const SYSTEM_ERRORS = {
  SYSTEM_INTERNAL_ERROR: {
    code: 'SYSTEM_INTERNAL_ERROR',
    message: 'Internal server error',
  },
  SYSTEM_UNKNOWN_ERROR: {
    code: 'SYSTEM_UNKNOWN_ERROR',
    message: 'An unknown error occurred',
  },
  SYSTEM_SERVICE_UNAVAILABLE: {
    code: 'SYSTEM_SERVICE_UNAVAILABLE',
    message: 'Service is temporarily unavailable',
  },
  SYSTEM_TOO_MANY_REQUESTS: {
    code: 'SYSTEM_TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later',
  },
  SYSTEM_DATABASE_ERROR: {
    code: 'SYSTEM_DATABASE_ERROR',
    message: 'Database error occurred',
  },
  SYSTEM_EXTERNAL_SERVICE_ERROR: {
    code: 'SYSTEM_EXTERNAL_SERVICE_ERROR',
    message: 'External service error',
  },
} as const;

// ==================== JOB ====================
export const JOB_ERRORS = {
  JOB_NOT_FOUND: {
    code: 'JOB_NOT_FOUND',
    message: 'Job not found',
  },
  JOB_CREATE_FAILED: {
    code: 'JOB_CREATE_FAILED',
    message: 'Failed to create job',
  },
  JOB_UPDATE_FAILED: {
    code: 'JOB_UPDATE_FAILED',
    message: 'Failed to update job',
  },
  JOB_DELETE_FAILED: {
    code: 'JOB_DELETE_FAILED',
    message: 'Failed to delete job',
  },
  JOB_NOT_OPEN: {
    code: 'JOB_NOT_OPEN',
    message: 'Job is not open for applications',
  },
  JOB_ALREADY_CLOSED: {
    code: 'JOB_ALREADY_CLOSED',
    message: 'Job is already closed',
  },
  JOB_OWNER_FORBIDDEN: {
    code: 'JOB_OWNER_FORBIDDEN',
    message: 'You are not the owner of this job',
  },
  JOB_WORKERS_FULL: {
    code: 'JOB_WORKERS_FULL',
    message: 'Job has reached maximum number of workers',
  },
  JOB_INVALID_TIME: {
    code: 'JOB_INVALID_TIME',
    message: 'End time must be after start time',
  },
} as const;

// ==================== JOB APPLICATION ====================
export const APPLICATION_ERRORS = {
  APPLICATION_NOT_FOUND: {
    code: 'APPLICATION_NOT_FOUND',
    message: 'Job application not found',
  },
  APPLICATION_ALREADY_APPLIED: {
    code: 'APPLICATION_ALREADY_APPLIED',
    message: 'You have already applied to this job',
  },
  APPLICATION_SELF_APPLY: {
    code: 'APPLICATION_SELF_APPLY',
    message: 'You cannot apply to your own job',
  },
  APPLICATION_NOT_PENDING: {
    code: 'APPLICATION_NOT_PENDING',
    message: 'Application is no longer pending',
  },
  APPLICATION_ACCESS_FORBIDDEN: {
    code: 'APPLICATION_ACCESS_FORBIDDEN',
    message: 'You are not allowed to access this application',
  },
  ASSIGNMENT_MUST_BE_ASSIGNED: {
    code: 'ASSIGNMENT_MUST_BE_ASSIGNED',
    message: 'Can only check in when the assignment is in ASSIGNED status',
  },
  ASSIGNMENT_MUST_BE_IN_PROGRESS: {
    code: 'ASSIGNMENT_MUST_BE_IN_PROGRESS',
    message:
      'Job must be in IN_PROGRESS status before completing. Please check in first.',
  },
  APPLICATION_CHAT_CLOSED: {
    code: 'APPLICATION_CHAT_CLOSED',
    message:
      'Messaging is only available after acceptance and before the job is completed',
  },
} as const;

// ==================== PROFILE ====================
export const PROFILE_ERRORS = {
  WORKER_PROFILE_NOT_FOUND: {
    code: 'WORKER_PROFILE_NOT_FOUND',
    message: 'Worker profile not found',
  },
  EMPLOYER_PROFILE_NOT_FOUND: {
    code: 'EMPLOYER_PROFILE_NOT_FOUND',
    message: 'Employer profile not found',
  },
  PROFILE_ALREADY_EXISTS: {
    code: 'PROFILE_ALREADY_EXISTS',
    message: 'Profile already exists',
  },
  PROFILE_UPDATE_FAILED: {
    code: 'PROFILE_UPDATE_FAILED',
    message: 'Failed to update profile',
  },
} as const;

// ==================== SKILL ====================
export const SKILL_ERRORS = {
  SKILL_NOT_FOUND: {
    code: 'SKILL_NOT_FOUND',
    message: 'Skill not found',
  },
  SKILL_ALREADY_EXISTS: {
    code: 'SKILL_ALREADY_EXISTS',
    message: 'Skill already exists',
  },
} as const;

// ==================== JOB CATEGORY ====================
export const CATEGORY_ERRORS = {
  CATEGORY_NOT_FOUND: {
    code: 'CATEGORY_NOT_FOUND',
    message: 'Job category not found',
  },
  CATEGORY_ALREADY_EXISTS: {
    code: 'CATEGORY_ALREADY_EXISTS',
    message: 'Job category already exists',
  },
} as const;

// ==================== REVIEW ====================
export const REVIEW_ERRORS = {
  REVIEW_NOT_FOUND: {
    code: 'REVIEW_NOT_FOUND',
    message: 'Review not found',
  },
  REVIEW_ALREADY_EXISTS: {
    code: 'REVIEW_ALREADY_EXISTS',
    message: 'You have already reviewed this job',
  },
  REVIEW_NOT_ALLOWED: {
    code: 'REVIEW_NOT_ALLOWED',
    message: 'You are not allowed to review this job',
  },
  REVIEW_JOB_NOT_COMPLETED: {
    code: 'REVIEW_JOB_NOT_COMPLETED',
    message: 'Job must be completed before reviewing',
  },
} as const;

// ==================== REPORT ====================
export const REPORT_ERRORS = {
  REPORT_NOT_FOUND: {
    code: 'REPORT_NOT_FOUND',
    message: 'Report not found',
  },
  REPORT_SELF_REPORT: {
    code: 'REPORT_SELF_REPORT',
    message: 'You cannot report yourself',
  },
  REPORT_ALREADY_EXISTS: {
    code: 'REPORT_ALREADY_EXISTS',
    message: 'You have already reported this user for this job',
  },
} as const;

// ==================== LOCATION ====================
export const LOCATION_ERRORS = {
  LOCATION_FETCH_FAILED: {
    code: 'LOCATION_FETCH_FAILED',
    message: 'Failed to fetch location data',
  },
  LOCATION_PROVINCE_NOT_FOUND: {
    code: 'LOCATION_PROVINCE_NOT_FOUND',
    message: 'Province not found',
  },
  LOCATION_WARD_NOT_FOUND: {
    code: 'LOCATION_WARD_NOT_FOUND',
    message: 'Ward not found',
  },
} as const;

// ==================== PAYMENT ====================
export const PAYMENT_ERRORS = {
  PAYMENT_NOT_FOUND: {
    code: 'PAYMENT_NOT_FOUND',
    message: 'Payment confirmation not found',
  },
  PAYMENT_ALREADY_CONFIRMED: {
    code: 'PAYMENT_ALREADY_CONFIRMED',
    message: 'Payment has already been confirmed',
  },
  PAYMENT_JOB_NOT_COMPLETED: {
    code: 'PAYMENT_JOB_NOT_COMPLETED',
    message: 'Job must be completed before confirming payment',
  },
  PAYMENT_NOT_WORKER: {
    code: 'PAYMENT_NOT_WORKER',
    message: 'Only the assigned worker can confirm payment',
  },
} as const;

// ==================== DISPUTE ====================
export const DISPUTE_ERRORS = {
  DISPUTE_NOT_FOUND: {
    code: 'DISPUTE_NOT_FOUND',
    message: 'Dispute not found',
  },
  DISPUTE_ALREADY_EXISTS: {
    code: 'DISPUTE_ALREADY_EXISTS',
    message: 'A dispute already exists for this job',
  },
  DISPUTE_NOT_INVOLVED: {
    code: 'DISPUTE_NOT_INVOLVED',
    message: 'You are not involved in this job',
  },
  DISPUTE_ALREADY_RESOLVED: {
    code: 'DISPUTE_ALREADY_RESOLVED',
    message: 'Dispute has already been resolved',
  },
} as const;

// ==================== ALL ERROR CODES ====================
export const ERROR_CODES = {
  ...AUTH_ERRORS,
  ...USER_ERRORS,
  ...PERMISSION_ERRORS,
  ...VALIDATION_ERRORS,
  ...RESOURCE_ERRORS,
  ...NOTIFICATION_ERRORS,
  ...UPLOAD_ERRORS,
  ...MAIL_ERRORS,
  ...SYSTEM_ERRORS,
  ...JOB_ERRORS,
  ...APPLICATION_ERRORS,
  ...PROFILE_ERRORS,
  ...SKILL_ERRORS,
  ...CATEGORY_ERRORS,
  ...REVIEW_ERRORS,
  ...REPORT_ERRORS,
  ...LOCATION_ERRORS,
  ...PAYMENT_ERRORS,
  ...DISPUTE_ERRORS,
} as const;

// Type for error code keys
export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Get error definition by error code
 */
export function getErrorDefinition(
  errorCode: string,
): ErrorDefinition | undefined {
  return ERROR_CODES[errorCode as ErrorCode];
}

/**
 * Get error message by error code
 */
export function getErrorMessage(errorCode: string): string {
  const errorDef = ERROR_CODES[errorCode as ErrorCode];
  return errorDef?.message || 'An error occurred';
}
