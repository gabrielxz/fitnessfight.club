'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface AuthFormProps<T = Record<string, string>> {
  onSubmit: (data: T) => Promise<void>
  loading?: boolean
  error?: string | null
}

// Google "G" logo SVG component following official branding guidelines
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.20419C17.64 8.56601 17.5827 7.95237 17.4764 7.36328H9V10.8446H13.8436C13.635 11.9696 13.0009 12.9228 12.0477 13.561V15.8192H14.9564C16.6582 14.2524 17.64 11.9451 17.64 9.20419Z"
        fill="#4285F4"
      />
      <path
        d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.96409 10.7098C3.78409 10.1698 3.68182 9.59301 3.68182 8.99983C3.68182 8.40664 3.78409 7.82983 3.96409 7.28983V4.95801H0.957275C0.347727 6.17301 0 7.54755 0 8.99983C0 10.4521 0.347727 11.8266 0.957275 13.0416L3.96409 10.7098Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95795L3.96409 7.28977C4.67182 5.16268 6.65591 3.57955 9 3.57955Z"
        fill="#EA4335"
      />
    </svg>
  )
}

export interface GoogleSignInButtonProps {
  onClick: () => void
  loading?: boolean
}

export function GoogleSignInButton({ onClick, loading }: GoogleSignInButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ minHeight: '40px' }} // Google requires minimum 40px height
    >
      <GoogleLogo />
      <span
        className="text-[14px] font-medium text-gray-700"
        style={{ fontFamily: 'Roboto, sans-serif' }}
      >
        Sign in with Google
      </span>
    </button>
  )
}

export function SignUpForm({
  onSubmit,
  loading,
  error,
}: AuthFormProps<{ email: string; password: string; fullName: string }>) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}

    // Validate email
    if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    // Validate password - check all requirements
    if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    } else if (
      !(
        /[a-z]/.test(formData.password) &&
        /[A-Z]/.test(formData.password) &&
        /[0-9]/.test(formData.password)
      )
    ) {
      errors.password = 'Password must contain uppercase, lowercase, and numbers'
    }

    // Validate name
    if (formData.fullName.trim().length < 2) {
      errors.fullName = 'Please enter your full name'
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors({})
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium mb-2">
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          required
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            validationErrors.fullName ? 'border-red-500' : 'border-gray-300'
          }`}
          value={formData.fullName}
          onChange={(e) => {
            setFormData({ ...formData, fullName: e.target.value })
            if (validationErrors.fullName) {
              setValidationErrors({ ...validationErrors, fullName: '' })
            }
          }}
          disabled={loading}
        />
        {validationErrors.fullName && (
          <p className="mt-1 text-sm text-red-600">{validationErrors.fullName}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500">
          Must be at least 8 characters with uppercase, lowercase, and numbers
        </p>
      </div>

      {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}

      {validationErrors.email && (
        <p className="text-sm text-red-600">Email: {validationErrors.email}</p>
      )}
      {validationErrors.password && (
        <p className="text-sm text-red-600">Password: {validationErrors.password}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Account...
          </>
        ) : (
          'Sign Up'
        )}
      </Button>
    </form>
  )
}

export function SignInForm({
  onSubmit,
  loading,
  error,
}: AuthFormProps<{ email: string; password: string }>) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          disabled={loading}
        />
      </div>

      {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing In...
          </>
        ) : (
          'Sign In'
        )}
      </Button>
    </form>
  )
}

export function ConfirmationCodeForm({
  onSubmit,
  onResend,
  loading,
  error,
}: AuthFormProps<{ code: string }> & { onResend: () => Promise<void> }) {
  const [code, setCode] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit({ code })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="code" className="block text-sm font-medium mb-2">
          Confirmation Code
        </label>
        <input
          id="code"
          type="text"
          required
          maxLength={6}
          pattern="[0-9]{6}"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={loading}
          placeholder="000000"
        />
        <p className="mt-1 text-xs text-gray-500">Enter the 6-digit code sent to your email</p>
      </div>

      {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}

      <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          'Verify Email'
        )}
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={onResend}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          disabled={loading}
        >
          Didn&apos;t receive a code? Resend
        </button>
      </div>
    </form>
  )
}
