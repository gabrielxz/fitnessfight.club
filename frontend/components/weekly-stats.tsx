'use client'

import { useEffect, useState } from 'react'
import { fetchWeeklyStats, checkStravaConnection, type WeeklyStats } from '@/lib/api'

export function WeeklyStatsComponent() {
  const [stats, setStats] = useState<WeeklyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stravaConnected, setStravaConnected] = useState(false)

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true)
      setError(null)

      try {
        // First check if Strava is connected
        const connectionStatus = await checkStravaConnection()

        if (!connectionStatus || !connectionStatus.connected) {
          setStravaConnected(false)
          setLoading(false)
          return
        }

        setStravaConnected(true)

        // Fetch weekly stats using the athlete ID
        if (connectionStatus.athleteId) {
          const weeklyStats = await fetchWeeklyStats(connectionStatus.athleteId)

          if (weeklyStats) {
            setStats(weeklyStats)
          } else {
            setError('Failed to load weekly stats')
          }
        }
      } catch (err) {
        console.error('Error loading stats:', err)
        setError('Failed to load training data')
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="mt-8 p-6 bg-muted/50 rounded-lg">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-12 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-40 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  // Not connected to Strava
  if (!stravaConnected) {
    return (
      <div className="mt-8 p-6 bg-muted/50 rounded-lg">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Weekly Training Hours</h3>
          <p className="text-muted-foreground text-sm">
            Connect your Strava account to see your training stats
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Unable to Load Stats</h3>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  // No stats available
  if (!stats) {
    return (
      <div className="mt-8 p-6 bg-muted/50 rounded-lg">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Weekly Training Hours</h3>
          <p className="text-muted-foreground text-sm">No training data available</p>
        </div>
      </div>
    )
  }

  // Display stats
  return (
    <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-1">Weekly Training Hours</h3>
        <p className="text-sm text-muted-foreground mb-4">{stats.weekRange}</p>

        <div className="mb-4">
          <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
            {stats.totalHours}
          </span>
          <span className="text-lg text-muted-foreground ml-2">
            hour{stats.totalHours !== 1 ? 's' : ''}
          </span>
        </div>

        {stats.activityCount === 0 ? (
          <p className="text-sm text-muted-foreground">No activities this week</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {stats.activityCount} {stats.activityCount === 1 ? 'activity' : 'activities'} completed
          </p>
        )}

        {/* Optional: Show recent activities */}
        {stats.activities && stats.activities.length > 0 && (
          <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
            <p className="text-xs text-muted-foreground mb-2">Recent activities:</p>
            <div className="space-y-1">
              {stats.activities.slice(0, 3).map((activity) => (
                <div
                  key={activity.activityId}
                  className="text-xs text-muted-foreground flex items-center justify-center gap-2"
                >
                  <span className="font-medium">{activity.name}</span>
                  <span>•</span>
                  <span>{activity.type}</span>
                  <span>•</span>
                  <span>{(activity.duration / 3600).toFixed(1)}h</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
