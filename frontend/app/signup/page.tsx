'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SignUpForm, ConfirmationCodeForm } from '@/components/auth-forms'
import { signUp, confirmSignUpCode, resendConfirmationCode } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  const [step, setStep] = useState<'signup' | 'confirm'>('signup')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSignUp(data: { email: string; password: string; fullName: string }) {
    console.log('handleSignUp called with:', data)
    setLoading(true)
    setError(null)

    try {
      const result = await signUp(data)
      console.log('signUp result:', result)

      if (result.success) {
        setEmail(data.email)
        setStep('confirm')
      } else {
        setError(result.error || 'Sign up failed')
      }
    } catch (err) {
      console.error('Error in handleSignUp:', err)
      setError('An unexpected error occurred')
    }

    setLoading(false)
  }

  async function handleConfirmation(data: { code: string }) {
    setLoading(true)
    setError(null)

    const result = await confirmSignUpCode(email, data.code)

    if (result.success) {
      // Redirect to sign in page after successful confirmation
      router.push('/signin?confirmed=true')
    } else {
      setError(result.error || 'Confirmation failed')
    }

    setLoading(false)
  }

  async function handleResendCode() {
    setLoading(true)
    setError(null)

    const result = await resendConfirmationCode(email)

    if (result.success) {
      setError(null)
      // Show success message
      alert('Confirmation code resent to your email')
    } else {
      setError(result.error || 'Failed to resend code')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold">
            {step === 'signup' ? 'Create your account' : 'Verify your email'}
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 'signup' ? (
              <>
                Already have an account?{' '}
                <Link href="/signin" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign in
                </Link>
              </>
            ) : (
              `We've sent a confirmation code to ${email}`
            )}
          </p>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {step === 'signup' ? (
            <SignUpForm onSubmit={handleSignUp} loading={loading} error={error} />
          ) : (
            <ConfirmationCodeForm
              onSubmit={handleConfirmation}
              onResend={handleResendCode}
              loading={loading}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  )
}
