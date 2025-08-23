import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/components/auth-provider'
import { getCurrentUser } from '@/lib/auth'

// Mock dependencies
jest.mock('@/lib/auth')

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
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
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

    it('should handle unauthenticated state', async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

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
})
