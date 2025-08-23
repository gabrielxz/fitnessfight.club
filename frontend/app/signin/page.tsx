'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SignInForm } from '@/components/auth-forms'
import { signIn } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function SignInContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if user just confirmed their email
    if (searchParams?.get('confirmed') === 'true') {
      setSuccessMessage('Email confirmed successfully! You can now sign in.')
    }
    // Check if user just reset their password
    if (searchParams?.get('reset') === 'success') {
      setSuccessMessage('Password reset successfully! You can now sign in with your new password.')
    }
  }, [searchParams])

  async function handleSignIn(data: { email: string; password: string }) {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    const result = await signIn(data)

    if (result.success) {
      // Redirect to home page or return URL
      const returnUrl = searchParams?.get('returnUrl') || '/'
      router.push(returnUrl)
      router.refresh()
    } else {
      setError(result.error || 'Sign in failed')
    }

    setLoading(false)
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

          <SignInForm onSubmit={handleSignIn} loading={loading} error={error} />

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
