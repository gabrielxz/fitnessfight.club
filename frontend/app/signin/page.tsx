'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { GoogleSignInButton } from '@/components/auth-forms'
import { federatedSignIn } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function SignInContent() {
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const confirmed = searchParams?.get('confirmed')
    const reset = searchParams?.get('reset')
    const authError = searchParams?.get('error')

    if (authError) {
      setError(authError)
    } else if (confirmed === 'true') {
      setSuccessMessage('Email confirmed successfully! You can now sign in.')
    } else if (reset === 'success') {
      setSuccessMessage('Password reset successfully! You can now sign in with your new password.')
    }
  }, [searchParams])

  async function handleGoogleSignIn() {
    try {
      setGoogleLoading(true)
      setError(null)
      // Initiate federated sign-in with Google
      await federatedSignIn('Google')
      // The page will redirect to Google OAuth
    } catch (err) {
      console.error('Google sign-in error:', err)
      setError(err instanceof Error ? err.message : 'Failed to initiate Google sign-in')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold">Sign in to your account</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </p>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {successMessage && (
            <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 rounded-md">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
          )}

          {/* Google Sign-In Button */}
          <div className="mb-6">
            <GoogleSignInButton onClick={handleGoogleSignIn} loading={googleLoading} />
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Sign-In temporarily disabled during Google OAuth implementation */}
          <div className="text-center text-sm text-gray-500">
            Email/password sign-in coming soon
          </div>

          <div className="mt-4 text-center">
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
              Forgot your password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  )
}
