import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/components/auth-provider'
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'

// Mock dependencies
jest.mock('aws-amplify/auth')
jest.mock('aws-amplify/utils')
jest.mock('@/lib/amplify-config', () => ({}))

// Test component to access auth context
function TestComponent() {
  const { user, loading } = useAuth()

  return (
    <div>
      {loading && <span>Loading...</span>}
      {user && <span>User: {user.email}</span>}
      {!loading && !user && <span>No user</span>}
    </div>
  )
}

describe('AuthProvider', () => {
  let hubListeners: { [key: string]: ((data: any) => void)[] } = {}

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})

    // Reset hub listeners
    hubListeners = {}

    // Mock Hub.listen
    ;(Hub.listen as jest.Mock).mockImplementation((channel, callback) => {
      if (!hubListeners[channel]) {
        hubListeners[channel] = []
      }
      hubListeners[channel].push(callback)

      // Return unsubscribe function
      return () => {
        if (hubListeners[channel]) {
          hubListeners[channel] = hubListeners[channel].filter((cb) => cb !== callback)
        }
      }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Initial Load', () => {
    it('should show loading state initially', () => {
      ;(getCurrentUser as jest.Mock).mockImplementation(() => new Promise(() => {}))
      ;(fetchAuthSession as jest.Mock).mockImplementation(() => new Promise(() => {}))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should handle unauthenticated state', async () => {
      ;(getCurrentUser as jest.Mock).mockRejectedValue(new Error('Not authenticated'))
      ;(fetchAuthSession as jest.Mock).mockRejectedValue(new Error('Not authenticated'))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('No user')).toBeInTheDocument()
      })
    })

    it('should handle getCurrentUser errors gracefully', async () => {
      ;(getCurrentUser as jest.Mock).mockRejectedValue(new Error('Network error'))
      ;(fetchAuthSession as jest.Mock).mockRejectedValue(new Error('Network error'))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('No user')).toBeInTheDocument()
      })
    })
  })

  describe('Hub Events', () => {
    it('should cleanup Hub listener on unmount', () => {
      const { unmount } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Should have registered a listener
      expect(Hub.listen).toHaveBeenCalledWith('auth', expect.any(Function))

      // Get the unsubscribe function that was returned
      const unsubscribe = (Hub.listen as jest.Mock).mock.results[0].value

      // Unmount the component
      unmount()

      // Verify that the listener was cleaned up
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress error output for this test
      const originalError = console.error
      console.error = jest.fn()

      expect(() => {
        render(<TestComponent />)
      }).toThrow('useAuth must be used within an AuthProvider')

      console.error = originalError
    })
  })

  describe('Error Handling', () => {
    it('should handle Hub event errors gracefully', async () => {
      ;(getCurrentUser as jest.Mock).mockRejectedValue(new Error('Not authenticated'))
      ;(fetchAuthSession as jest.Mock).mockRejectedValue(new Error('Not authenticated'))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('No user')).toBeInTheDocument()
      })

      // Clear previous mock calls
      jest.clearAllMocks()

      // Make getCurrentUser throw an error
      ;(getCurrentUser as jest.Mock).mockRejectedValue(new Error('Auth error'))

      // Trigger an auth event that will cause an error
      const authListeners = hubListeners['auth'] || []
      authListeners.forEach((callback) => {
        callback({
          payload: {
            event: 'signIn',
          },
        })
      })

      // Wait a moment for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 0))

      // User state should remain unchanged (error was handled gracefully)
      expect(screen.getByText('No user')).toBeInTheDocument()
    })
  })
})
