import { getConfig } from '@/lib/config'

export interface WeeklyStats {
  success: boolean
  userId: string
  weekRange: string
  totalHours: number
  activityCount: number
  activities: Array<{
    activityId: string
    name: string
    type: string
    duration: number
    distance: number
    startDate: string
  }>
}

/**
 * Fetch weekly training stats for a user
 */
export async function fetchWeeklyStats(userId: string): Promise<WeeklyStats | null> {
  try {
    const config = getConfig()

    const response = await fetch(`${config.apiUrl}/users/${userId}/weekly-stats`)

    if (!response.ok) {
      if (response.status === 401) {
        console.error('Authentication expired')
      } else if (response.status === 403) {
        console.error('Not authorized to view these stats')
      } else {
        console.error(`Failed to fetch weekly stats: ${response.status}`)
      }
      return null
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching weekly stats:', error)
    return null
  }
}

/**
 * Check if user has Strava connected
 */
export async function checkStravaConnection(): Promise<{
  connected: boolean
  athleteId?: string
} | null> {
  try {
    const config = getConfig()

    const response = await fetch(`${config.apiUrl}/users`)

    if (response.ok) {
      const data = await response.json()
      if (data.user && data.user.stravaId) {
        return {
          connected: true,
          athleteId: data.user.userId,
        }
      }
    }

    return { connected: false }
  } catch (error) {
    console.error('Error checking Strava connection:', error)
    return null
  }
}
