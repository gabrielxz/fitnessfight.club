/**
 * Maps AWS Cognito error codes to user-friendly messages
 */

export interface AuthError {
  code: string
  message: string
  field?: 'email' | 'password' | 'code'
}

const ERROR_MESSAGES: Record<string, AuthError> = {
  // Sign Up Errors
  UsernameExistsException: {
    code: 'EMAIL_EXISTS',
    message: 'An account with this email already exists. Please sign in instead.',
    field: 'email',
  },
  InvalidPasswordException: {
    code: 'INVALID_PASSWORD',
    message:
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
    field: 'password',
  },
  InvalidParameterException: {
    code: 'INVALID_PARAMETER',
    message: 'Please check your input and try again.',
  },

  // Sign In Errors
  UserNotFoundException: {
    code: 'USER_NOT_FOUND',
    message: 'No account found with this email address. Please sign up first.',
    field: 'email',
  },
  NotAuthorizedException: {
    code: 'INVALID_CREDENTIALS',
    message: 'Incorrect email or password. Please try again.',
    field: 'password',
  },
  UserNotConfirmedException: {
    code: 'EMAIL_NOT_CONFIRMED',
    message:
      'Please verify your email address before signing in. Check your inbox for the verification code.',
  },
  PasswordResetRequiredException: {
    code: 'PASSWORD_RESET_REQUIRED',
    message: 'You must reset your password before signing in.',
  },

  // Confirmation Code Errors
  CodeMismatchException: {
    code: 'INVALID_CODE',
    message: 'Invalid verification code. Please check and try again.',
    field: 'code',
  },
  ExpiredCodeException: {
    code: 'EXPIRED_CODE',
    message: 'Verification code has expired. Please request a new one.',
    field: 'code',
  },

  // Rate Limiting
  LimitExceededException: {
    code: 'RATE_LIMIT',
    message: 'Too many attempts. Please wait a few minutes and try again.',
  },
  TooManyRequestsException: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests. Please slow down and try again.',
  },
  TooManyFailedAttemptsException: {
    code: 'TOO_MANY_FAILED_ATTEMPTS',
    message:
      'Too many failed attempts. Your account has been temporarily locked. Please try again later.',
  },

  // Network Errors
  NetworkError: {
    code: 'NETWORK_ERROR',
    message: 'Unable to connect. Please check your internet connection and try again.',
  },
}

/**
 * Maps an error to a user-friendly message
 */
export function mapAuthError(error: unknown): AuthError {
  // Type guard to check if error is an object with properties
  const errorObj = error as { name?: string; code?: string; message?: string }

  // Check for specific error names/codes
  if (errorObj.name && ERROR_MESSAGES[errorObj.name]) {
    return ERROR_MESSAGES[errorObj.name]
  }

  if (errorObj.code && ERROR_MESSAGES[errorObj.code]) {
    return ERROR_MESSAGES[errorObj.code]
  }

  // Check for network errors
  if (
    errorObj.message?.toLowerCase().includes('network') ||
    errorObj.message?.toLowerCase().includes('fetch')
  ) {
    return ERROR_MESSAGES.NetworkError
  }

  // Parse error message for common patterns
  const errorMessage = errorObj.message || String(error)

  if (errorMessage.includes('User does not exist')) {
    return ERROR_MESSAGES.UserNotFoundException
  }

  if (errorMessage.includes('Incorrect username or password')) {
    return ERROR_MESSAGES.NotAuthorizedException
  }

  if (errorMessage.includes('User is not confirmed')) {
    return ERROR_MESSAGES.UserNotConfirmedException
  }

  if (errorMessage.includes('Password did not conform')) {
    return ERROR_MESSAGES.InvalidPasswordException
  }

  // Default error
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
  }
}

/**
 * Formats error for display
 */
export function formatAuthError(error: unknown): string {
  const authError = mapAuthError(error)
  return authError.message
}

/**
 * Gets field-specific error
 */
export function getFieldError(error: unknown, field: 'email' | 'password' | 'code'): string | null {
  const authError = mapAuthError(error)
  return authError.field === field ? authError.message : null
}
