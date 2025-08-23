'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { StravaConnectButton } from '@/components/strava-connect-button'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function HomeContent() {
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    // Check for OAuth callback parameters
    const connected = searchParams?.get('connected')
    const error = searchParams?.get('error')

    let timer: NodeJS.Timeout | undefined

    if (connected === 'true') {
      setStatusMessage({
        type: 'success',
        message: '✅ Successfully connected to Strava! Your activities will now be tracked.',
      })
      // Clean URL after showing message
      window.history.replaceState({}, '', '/')

      // Auto-dismiss message after 5 seconds
      timer = setTimeout(() => {
        setStatusMessage(null)
      }, 5000)
    } else if (error) {
      let errorMessage = 'Failed to connect to Strava. '
      switch (error) {
        case 'authorization_denied':
          errorMessage += 'You denied the authorization request.'
          break
        case 'no_code':
          errorMessage += 'No authorization code received.'
          break
        case 'config_error':
          errorMessage += 'Server configuration error. Please try again later.'
          break
        case 'token_exchange_failed':
          errorMessage += 'Failed to complete authentication. Please try again.'
          break
        default:
          errorMessage += 'An unexpected error occurred.'
      }
      setStatusMessage({
        type: 'error',
        message: errorMessage,
      })
      // Clean URL after showing message
      window.history.replaceState({}, '', '/')

      // Auto-dismiss message after 5 seconds
      timer = setTimeout(() => {
        setStatusMessage(null)
      }, 5000)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [searchParams])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm">
        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mb-8 p-4 rounded-lg text-center transition-all duration-300 ${
              statusMessage.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}
          >
            <p className="font-medium">{statusMessage.message}</p>
          </div>
        )}

        <h1 className="text-4xl font-bold text-center mb-8">Fitness Fight Club</h1>
        <p className="text-center text-muted-foreground mb-8">
          Track your fitness journey with your Strava club
        </p>
        <div className="mt-8 flex items-center justify-center">
          <Image
            src="/ffcww2.png"
            alt="Fitness Fight Club"
            width={600}
            height={400}
            className="rounded-lg shadow-lg"
            priority
          />
        </div>
        <div className="mt-12 flex items-center justify-center">
          {authLoading ? (
            <div className="h-12 w-48 bg-muted animate-pulse rounded-md" />
          ) : user ? (
            <StravaConnectButton />
          ) : (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Please sign in to connect your Strava account</p>
              <div className="flex items-center justify-center space-x-4">
                <Link href="/signin">
                  <Button variant="outline">Sign In</Button>
                </Link>
                <Link href="/signup">
                  <Button>Sign Up</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}
