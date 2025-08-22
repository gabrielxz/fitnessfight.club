'use client'

import { useState } from 'react'
import { getConfig } from '@/lib/config'

export function StravaConnectButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const config = getConfig()

      // Fetch the authorization URL from our backend
      const response = await fetch(`${config.apiUrl}/auth/strava`)

      if (!response.ok) {
        throw new Error('Failed to get authorization URL')
      }

      const data = await response.json()

      // Debug logging
      if (data.debug) {
        console.error('OAuth Debug Info:', data.debug)
      }

      // Redirect to Strava's OAuth page
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl
      } else {
        throw new Error('No authorization URL received')
      }
    } catch (err) {
      console.error('Error connecting to Strava:', err)
      setError('Failed to connect to Strava. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleConnect}
        disabled={isLoading}
        className="bg-[#FC4C02] hover:bg-[#E34402] text-white font-bold py-3 px-6 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            <span>Connect with Strava</span>
          </>
        )}
      </button>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
    </div>
  )
}
