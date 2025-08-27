'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SignInForm, GoogleSignInButton } from '@/components/auth-forms'
import { signIn, federatedSignIn } from '@/lib/auth'
import { useAuth } from '@/components/auth-provider'
import { setAuthTokens } from '@/lib/cognito-client'

export const dynamic = 'force-dynamic'

function SignInContent() {
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()

  useEffect(() => {
    function handleUrlChange() {
      const hash = window.location.hash

      if (hash && (hash.includes('id_token') || hash.includes('access_token'))) {
        handleOAuthCallback()
        return // Stop processing if we have a token in the hash
      }

      const confirmed = searchParams?.get('confirmed')
      const reset = searchParams?.get('reset')
      const error = searchParams?.get('error')
      const errorDescription = searchParams?.get('error_description')

      if (error) {
        const errorMessage = errorDescription || error || 'Authentication failed'
        setError(errorMessage)
        // Clean URL by removing OAuth parameters
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete('error')
        newUrl.searchParams.delete('error_description')
        window.history.replaceState({}, '', newUrl.toString())
      } else if (confirmed === 'true') {
        setSuccessMessage('Email confirmed successfully! You can now sign in.')
      } else if (reset === 'success') {
        setSuccessMessage(
          'Password reset successfully! You can now sign in with your new password.'
        )
      }
    }

    handleUrlChange()
    window.addEventListener('hashchange', handleUrlChange)

    return () => {
      window.removeEventListener('hashchange', handleUrlChange)
    }
  }, [searchParams])

  async function handleOAuthCallback() {
    try {
      setLoading(true)

      // Parse tokens from URL fragment
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const idToken = params.get('id_token')
      const accessToken = params.get('access_token')

      if (idToken && accessToken) {
        // Store tokens
        setAuthTokens({
          IdToken: idToken,
          AccessToken: accessToken,
        })

        // Refresh user state
        await refreshUser()

        // Clean URL - remove hash and any OAuth params
        if (typeof window !== 'undefined') {
          const newUrl = new URL(window.location.href)
          newUrl.hash = ''
          window.history.replaceState({}, '', newUrl.toString())
        }

        // Redirect to home
        router.push('/')
      } else {
        // No tokens found in hash
        console.error('No tokens found in OAuth callback')
        setError('Authentication failed. No tokens received.')
      }
    } catch (err) {
      console.error('OAuth callback error:', err)
      setError('Failed to complete authentication. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignIn(data: { email: string; password: string }) {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    const result = await signIn(data)

    if (result.success) {
      // Refresh auth state before redirecting
      await refreshUser()
      // Redirect to home page or return URL
      const returnUrl = searchParams?.get('returnUrl') || '/'
      router.push(returnUrl)
    } else {
      setError(result.error || 'Sign in failed')
    }

    setLoading(false)
  }

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

          {/* Google Sign-In Button */}
          <div className="mb-6">
            <GoogleSignInButton onClick={handleGoogleSignIn} loading={googleLoading || loading} />
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

          <SignInForm onSubmit={handleSignIn} loading={loading || googleLoading} error={error} />

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
