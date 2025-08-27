'use client'

import Image from 'next/image'
import { useAuth } from '@/components/auth-context'
import { StravaConnectButton } from '@/components/strava-connect-button'
import { WeeklyStatsComponent } from '@/components/weekly-stats'
import { getCognitoAuthUrl } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export default function Home() {
  const { isLoggedIn } = useAuth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm">
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
        <div className="mt-12 flex flex-col items-center justify-center">
          {isLoggedIn ? (
            <>
              <StravaConnectButton />
              <WeeklyStatsComponent />
            </>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Please sign in to connect your Strava account</p>
              <div className="flex items-center justify-center space-x-4">
                <Button onClick={() => (window.location.href = getCognitoAuthUrl())}>
                  Sign In
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
