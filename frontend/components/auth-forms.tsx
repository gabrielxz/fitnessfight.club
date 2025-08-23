'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface AuthFormProps<T = Record<string, string>> {
  onSubmit: (data: T) => Promise<void>
  loading?: boolean
  error?: string | null
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

    // Validate password - only check length
    if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
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
        <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
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
