import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/components/auth-provider'
import { getCurrentUser } from 'aws-amplify/auth'
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

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should load authenticated user on mount', async () => {
      const mockUser = {
        username: 'test@example.com',
        userId: 'cognito-123',
        signInDetails: {
          loginId: 'test@example.com',
        },
      }

      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
      })

      expect(getCurrentUser).toHaveBeenCalled()
    })

    it('should handle unauthenticated state', async () => {
      ;(getCurrentUser as jest.Mock).mockRejectedValue(new Error('Not authenticated'))

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

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('No user')).toBeInTheDocument()
      })

      expect(console.error).toHaveBeenCalledWith('Failed to get current user:', expect.any(Error))
    })
  })

  describe('Hub Events', () => {
    it('should update user on signIn event', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('No user')).toBeInTheDocument()
      })

      // Simulate sign in event
      const mockUser = {
        username: 'test@example.com',
        userId: 'cognito-123',
        signInDetails: {
          loginId: 'test@example.com',
        },
      }

      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      // Trigger Hub event
      const authListeners = hubListeners['auth'] || []
      authListeners.forEach((callback) => {
        callback({
          payload: {
            event: 'signIn',
            data: mockUser,
          },
        })
      })

      await waitFor(() => {
        expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
      })
    })

    it('should clear user on signOut event', async () => {
      const mockUser = {
        username: 'test@example.com',
        userId: 'cognito-123',
        signInDetails: {
          loginId: 'test@example.com',
        },
      }

      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
      })

      // Trigger sign out event
      const authListeners = hubListeners['auth'] || []
      authListeners.forEach((callback) => {
        callback({
          payload: {
            event: 'signOut',
          },
        })
      })

      await waitFor(() => {
        expect(screen.getByText('No user')).toBeInTheDocument()
      })
    })

    it('should handle tokenRefresh event', async () => {
      const mockUser = {
        username: 'test@example.com',
        userId: 'cognito-123',
        signInDetails: {
          loginId: 'test@example.com',
        },
      }

      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
      })

      // Clear mock calls
      jest.clearAllMocks()

      // Update user data
      const updatedUser = {
        ...mockUser,
        username: 'updated@example.com',
        signInDetails: {
          loginId: 'updated@example.com',
        },
      }

      ;(getCurrentUser as jest.Mock).mockResolvedValue(updatedUser)

      // Trigger token refresh event
      const authListeners = hubListeners['auth'] || []
      authListeners.forEach((callback) => {
        callback({
          payload: {
            event: 'tokenRefresh',
          },
        })
      })

      await waitFor(() => {
        expect(screen.getByText('User: updated@example.com')).toBeInTheDocument()
      })

      expect(getCurrentUser).toHaveBeenCalled()
    })

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

    it('should provide user and loading state', async () => {
      const mockUser = {
        username: 'test@example.com',
        userId: 'cognito-123',
        signInDetails: {
          loginId: 'test@example.com',
        },
      }

      ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Initially loading
      expect(screen.getByText('Loading...')).toBeInTheDocument()

      // After loading, user is available
      await waitFor(() => {
        expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle Hub event errors gracefully', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('No user')).toBeInTheDocument()
      })

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

      // Should handle error gracefully and keep current state
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Failed to get current user:', expect.any(Error))
      })

      // User state should remain unchanged
      expect(screen.getByText('No user')).toBeInTheDocument()
    })
  })
})
