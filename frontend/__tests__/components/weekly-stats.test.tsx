import { render, screen, waitFor } from '@testing-library/react'
import { WeeklyStatsComponent } from '@/components/weekly-stats'
import { AuthProvider } from '@/components/auth-provider'
import { fetchWeeklyStats, checkStravaConnection } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'

// Mock dependencies
jest.mock('@/lib/api')
jest.mock('@/lib/auth')

describe('WeeklyStats Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Unauthenticated State', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockRejectedValue(new Error('Not authenticated'))
    })

    it('should not render when user is not authenticated', async () => {
      const { container } = render(
        <AuthProvider>
          <WeeklyStatsComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(container.firstChild).toBeNull()
      })
    })
  })

  describe('Authenticated State', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue({
        username: 'test@example.com',
        userId: 'cognito-123',
      })
    })

    describe('Loading State', () => {
      it('should show loading skeleton while fetching data', async () => {
        ;(checkStravaConnection as jest.Mock).mockImplementation(
          () => new Promise(() => {}) // Never resolves
        )

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          const skeleton = document.querySelector('.animate-pulse')
          expect(skeleton).toBeInTheDocument()
        })
      })
    })

    describe('Strava Not Connected', () => {
      it('should show connect Strava message when not connected', async () => {
        ;(checkStravaConnection as jest.Mock).mockResolvedValue({
          connected: false,
        })

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(screen.getByText('Weekly Training Hours')).toBeInTheDocument()
          expect(
            screen.getByText('Connect your Strava account to see your training stats')
          ).toBeInTheDocument()
        })
      })

      it('should handle null connection status', async () => {
        ;(checkStravaConnection as jest.Mock).mockResolvedValue(null)

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(
            screen.getByText('Connect your Strava account to see your training stats')
          ).toBeInTheDocument()
        })
      })
    })

    describe('Strava Connected', () => {
      beforeEach(() => {
        ;(checkStravaConnection as jest.Mock).mockResolvedValue({
          connected: true,
          athleteId: '12345',
        })
      })

      it('should display weekly stats when data is available', async () => {
        const mockStats = {
          success: true,
          userId: '12345',
          weekRange: 'Jan 22 - Jan 28',
          totalHours: 5.5,
          activityCount: 3,
          activities: [
            {
              activityId: '1',
              name: 'Morning Run',
              type: 'Run',
              duration: 3600,
              distance: 10000,
              startDate: '2024-01-22T08:00:00Z',
            },
            {
              activityId: '2',
              name: 'Evening Ride',
              type: 'Ride',
              duration: 7200,
              distance: 30000,
              startDate: '2024-01-23T18:00:00Z',
            },
          ],
        }

        ;(fetchWeeklyStats as jest.Mock).mockResolvedValue(mockStats)

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(screen.getByText('Weekly Training Hours')).toBeInTheDocument()
          expect(screen.getByText('Jan 22 - Jan 28')).toBeInTheDocument()
          expect(screen.getByText('5.5')).toBeInTheDocument()
          expect(screen.getByText('hours')).toBeInTheDocument()
          expect(screen.getByText('3 activities completed')).toBeInTheDocument()
        })
      })

      it('should display recent activities when available', async () => {
        const mockStats = {
          success: true,
          userId: '12345',
          weekRange: 'Jan 22 - Jan 28',
          totalHours: 3.5,
          activityCount: 2,
          activities: [
            {
              activityId: '1',
              name: 'Morning Run',
              type: 'Run',
              duration: 3600,
              distance: 10000,
              startDate: '2024-01-22T08:00:00Z',
            },
            {
              activityId: '2',
              name: 'Evening Ride',
              type: 'Ride',
              duration: 9000,
              distance: 30000,
              startDate: '2024-01-23T18:00:00Z',
            },
          ],
        }

        ;(fetchWeeklyStats as jest.Mock).mockResolvedValue(mockStats)

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(screen.getByText('Recent activities:')).toBeInTheDocument()
          expect(screen.getByText('Morning Run')).toBeInTheDocument()
          expect(screen.getByText('Evening Ride')).toBeInTheDocument()
          expect(screen.getByText('1.0h')).toBeInTheDocument() // 3600 seconds = 1 hour
          expect(screen.getByText('2.5h')).toBeInTheDocument() // 9000 seconds = 2.5 hours
        })
      })

      it('should display singular hour text for 1 hour', async () => {
        const mockStats = {
          success: true,
          userId: '12345',
          weekRange: 'Jan 22 - Jan 28',
          totalHours: 1,
          activityCount: 1,
          activities: [],
        }

        ;(fetchWeeklyStats as jest.Mock).mockResolvedValue(mockStats)

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(screen.getByText('1')).toBeInTheDocument()
          expect(screen.getByText('hour')).toBeInTheDocument()
          expect(screen.queryByText('hours')).not.toBeInTheDocument()
        })
      })

      it('should display singular activity text for 1 activity', async () => {
        const mockStats = {
          success: true,
          userId: '12345',
          weekRange: 'Jan 22 - Jan 28',
          totalHours: 2.5,
          activityCount: 1,
          activities: [],
        }

        ;(fetchWeeklyStats as jest.Mock).mockResolvedValue(mockStats)

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(screen.getByText('1 activity completed')).toBeInTheDocument()
        })
      })

      it('should handle zero activities in the week', async () => {
        const mockStats = {
          success: true,
          userId: '12345',
          weekRange: 'Jan 22 - Jan 28',
          totalHours: 0,
          activityCount: 0,
          activities: [],
        }

        ;(fetchWeeklyStats as jest.Mock).mockResolvedValue(mockStats)

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(screen.getByText('0')).toBeInTheDocument()
          expect(screen.getByText('hours')).toBeInTheDocument()
          expect(screen.getByText('No activities this week')).toBeInTheDocument()
        })
      })

      it('should limit recent activities display to 3', async () => {
        const mockStats = {
          success: true,
          userId: '12345',
          weekRange: 'Jan 22 - Jan 28',
          totalHours: 10,
          activityCount: 5,
          activities: [
            { activityId: '1', name: 'Activity 1', type: 'Run', duration: 3600 },
            { activityId: '2', name: 'Activity 2', type: 'Run', duration: 3600 },
            { activityId: '3', name: 'Activity 3', type: 'Run', duration: 3600 },
            { activityId: '4', name: 'Activity 4', type: 'Run', duration: 3600 },
            { activityId: '5', name: 'Activity 5', type: 'Run', duration: 3600 },
          ],
        }

        ;(fetchWeeklyStats as jest.Mock).mockResolvedValue(mockStats)

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(screen.getByText('Activity 1')).toBeInTheDocument()
          expect(screen.getByText('Activity 2')).toBeInTheDocument()
          expect(screen.getByText('Activity 3')).toBeInTheDocument()
          expect(screen.queryByText('Activity 4')).not.toBeInTheDocument()
          expect(screen.queryByText('Activity 5')).not.toBeInTheDocument()
        })
      })
    })

    describe('Error Handling', () => {
      beforeEach(() => {
        ;(checkStravaConnection as jest.Mock).mockResolvedValue({
          connected: true,
          athleteId: '12345',
        })
      })

      it('should display error message when API call fails', async () => {
        ;(fetchWeeklyStats as jest.Mock).mockRejectedValue(new Error('API Error'))
        jest.spyOn(console, 'error').mockImplementation(() => {})

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(screen.getByText('Unable to Load Stats')).toBeInTheDocument()
          expect(screen.getByText('Failed to load training data')).toBeInTheDocument()
        })

        jest.restoreAllMocks()
      })

      it('should display error when fetchWeeklyStats returns null', async () => {
        ;(fetchWeeklyStats as jest.Mock).mockResolvedValue(null)

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(screen.getByText('Unable to Load Stats')).toBeInTheDocument()
          expect(screen.getByText('Failed to load weekly stats')).toBeInTheDocument()
        })
      })

      it('should handle missing athleteId gracefully', async () => {
        ;(checkStravaConnection as jest.Mock).mockResolvedValue({
          connected: true,
          // athleteId is missing
        })

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          // Should not call fetchWeeklyStats
          expect(fetchWeeklyStats).not.toHaveBeenCalled()
        })
      })
    })

    describe('No Data State', () => {
      beforeEach(() => {
        ;(checkStravaConnection as jest.Mock).mockResolvedValue({
          connected: true,
          athleteId: '12345',
        })
      })

      it('should display error message when stats is undefined after loading', async () => {
        ;(fetchWeeklyStats as jest.Mock).mockResolvedValue(undefined)

        render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          expect(screen.getByText('Unable to Load Stats')).toBeInTheDocument()
          expect(screen.getByText('Failed to load weekly stats')).toBeInTheDocument()
        })
      })
    })

    describe('Component Styling', () => {
      beforeEach(() => {
        ;(checkStravaConnection as jest.Mock).mockResolvedValue({
          connected: true,
          athleteId: '12345',
        })
      })

      it('should have proper styling classes', async () => {
        const mockStats = {
          success: true,
          userId: '12345',
          weekRange: 'Jan 22 - Jan 28',
          totalHours: 5.5,
          activityCount: 3,
          activities: [],
        }

        ;(fetchWeeklyStats as jest.Mock).mockResolvedValue(mockStats)

        const { container } = render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          const statsContainer = container.querySelector('.bg-gradient-to-br')
          expect(statsContainer).toBeInTheDocument()
          expect(statsContainer).toHaveClass('from-blue-50', 'to-purple-50')
        })
      })

      it('should apply error styling for error state', async () => {
        ;(fetchWeeklyStats as jest.Mock).mockRejectedValue(new Error('API Error'))
        jest.spyOn(console, 'error').mockImplementation(() => {})

        const { container } = render(
          <AuthProvider>
            <WeeklyStatsComponent />
          </AuthProvider>
        )

        await waitFor(() => {
          const errorContainer = container.querySelector('.bg-red-50')
          expect(errorContainer).toBeInTheDocument()
          expect(errorContainer).toHaveClass('border-red-200')
        })

        jest.restoreAllMocks()
      })
    })
  })
})
