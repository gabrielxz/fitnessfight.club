import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInPage from '@/app/signin/page'
import { AuthProvider } from '@/components/auth-provider'
import * as authLib from '@/lib/auth'
import * as cognitoClient from '@/lib/cognito-client'

// Mock dependencies
const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockGet = jest.fn()
const mockRefreshUser = jest.fn().mockResolvedValue(undefined)

jest.mock('@/lib/auth', () => ({
  signIn: jest.fn(),
  federatedSignIn: jest.fn(),
  getCurrentUser: jest.fn(() => Promise.resolve(null)),
}))

jest.mock('@/lib/cognito-client', () => ({
  setAuthTokens: jest.fn(),
  getAuthTokens: jest.fn(),
  clearAuthTokens: jest.fn(),
  CLIENT_ID: 'test-client-id',
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
    refresh: mockRefresh,
  })),
  useSearchParams: jest.fn(() => ({
    get: mockGet,
  })),
}))

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  }
})

// Mock the auth context
jest.mock('@/components/auth-provider', () => {
  const originalModule = jest.requireActual('@/components/auth-provider')
  return {
    ...originalModule,
    useAuth: () => ({
      user: null,
      loading: false,
      refreshUser: mockRefreshUser,
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

// Setup window.location mock
const mockLocation = {
  hash: '',
  href: 'https://dev.fitnessfight.club/signin',
  origin: 'https://dev.fitnessfight.club',
  pathname: '/signin',
  search: '',
  hostname: 'dev.fitnessfight.club',
  protocol: 'https:',
  port: '',
  host: 'dev.fitnessfight.club',
  assign: jest.fn(),
  reload: jest.fn(),
  replace: jest.fn(),
  toString: jest.fn(() => 'https://dev.fitnessfight.club/signin'),
}

// Only mock location if not already mocked (prevents redefinition error)
if (!window.location || typeof window.location === 'object') {
  delete (window as unknown as { location: Location }).location
  window.location = mockLocation as unknown as Location
}

describe('SignIn Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock location
    mockLocation.hash = ''
    mockLocation.href = 'https://dev.fitnessfight.club/signin'
    mockLocation.search = ''
    // Mock window functions
    window.history.replaceState = jest.fn()
  })

  it('should render sign in page', () => {
    render(
      <AuthProvider>
        <SignInPage />
      </AuthProvider>
    )
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
  })

  it('should have sign up link', () => {
    render(
      <AuthProvider>
        <SignInPage />
      </AuthProvider>
    )
    expect(screen.getByText(/Don't have an account/)).toBeInTheDocument()
  })

  it('should render Google sign-in button', () => {
    render(
      <AuthProvider>
        <SignInPage />
      </AuthProvider>
    )

    const googleButton = screen.getByRole('button', { name: /Sign in with Google/i })
    expect(googleButton).toBeInTheDocument()
  })

  it('should show divider between Google button and email form', () => {
    render(
      <AuthProvider>
        <SignInPage />
      </AuthProvider>
    )

    expect(screen.getByText('Or continue with email')).toBeInTheDocument()
  })

  describe('Google OAuth', () => {
    it('should call federatedSignIn when Google button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      const googleButton = screen.getByRole('button', { name: /Sign in with Google/i })
      await user.click(googleButton)

      expect(authLib.federatedSignIn).toHaveBeenCalledWith('Google')
    })

    it('should handle Google sign-in errors', async () => {
      const user = userEvent.setup()
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      ;(authLib.federatedSignIn as jest.Mock).mockRejectedValue(
        new Error('Failed to initiate Google sign-in')
      )

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      const googleButton = screen.getByRole('button', { name: /Sign in with Google/i })
      await user.click(googleButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to initiate Google sign-in')).toBeInTheDocument()
      })

      consoleErrorSpy.mockRestore()
    })

    it('should show loading state on Google button when clicked', async () => {
      const user = userEvent.setup()
      ;(authLib.federatedSignIn as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      const googleButton = screen.getByRole('button', { name: /Sign in with Google/i })
      await user.click(googleButton)

      // The button should be disabled when loading (text doesn't change)
      expect(googleButton).toBeDisabled()
      expect(googleButton).toHaveTextContent('Sign in with Google')
    })
  })

  describe('OAuth Callback Handling', () => {
    it.skip('should handle successful OAuth callback with tokens in URL fragment', async () => {
      // Set up mocks before rendering
      mockGet.mockImplementation((param: string) => {
        if (param === 'code') return 'test-code'
        return null
      })

      // Set up the location mock with tokens - need to update the actual window.location
      mockLocation.hash =
        '#id_token=test-id-token&access_token=test-access-token&token_type=Bearer&expires_in=3600'

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      await waitFor(
        () => {
          expect(cognitoClient.setAuthTokens).toHaveBeenCalledWith({
            IdToken: 'test-id-token',
            AccessToken: 'test-access-token',
          })
        },
        { timeout: 2000 }
      )

      await waitFor(() => {
        expect(mockRefreshUser).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/')
        expect(mockRefresh).toHaveBeenCalled()
        expect(window.history.replaceState).toHaveBeenCalled()
      })
    })

    it('should handle OAuth error in URL parameters', async () => {
      mockGet.mockImplementation((param: string) => {
        if (param === 'error') return 'access_denied'
        if (param === 'error_description') return 'User denied access'
        return null
      })

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('User denied access')).toBeInTheDocument()
      })

      expect(window.history.replaceState).toHaveBeenCalled()
    })

    it('should show generic error message when error_description is missing', async () => {
      mockGet.mockImplementation((param: string) => {
        if (param === 'error') return 'server_error'
        return null
      })

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('server_error')).toBeInTheDocument()
      })
    })

    it.skip('should clean URL after processing OAuth callback', async () => {
      mockGet.mockImplementation((param: string) => {
        if (param === 'code') return 'test-code'
        return null
      })

      mockLocation.hash = '#id_token=test-id-token&access_token=test-access-token'
      mockLocation.href = 'https://dev.fitnessfight.club/signin?code=test-code&state=test-state'

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      await waitFor(
        () => {
          expect(window.history.replaceState).toHaveBeenCalled()
        },
        { timeout: 2000 }
      )

      // Check that the URL was cleaned
      const replaceStateCalls = (window.history.replaceState as jest.Mock).mock.calls
      if (replaceStateCalls.length > 0) {
        const lastCall = replaceStateCalls[replaceStateCalls.length - 1]
        const cleanedUrl = lastCall[2]

        expect(cleanedUrl).not.toContain('code=')
        expect(cleanedUrl).not.toContain('state=')
        expect(cleanedUrl).not.toContain('#')
      }
    })

    it('should handle OAuth callback without tokens in fragment', async () => {
      mockLocation.hash = ''
      mockGet.mockImplementation((param: string) => {
        if (param === 'code') return 'test-code'
        return null
      })

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('Authentication successful! Redirecting...')).toBeInTheDocument()
      })

      // Wait for the timeout to complete
      await waitFor(
        () => {
          expect(mockRefreshUser).toHaveBeenCalled()
          expect(mockPush).toHaveBeenCalledWith('/')
        },
        { timeout: 3000 }
      )
    })

    it.skip('should handle OAuth callback errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      mockGet.mockImplementation((param: string) => {
        if (param === 'code') return 'test-code'
        return null
      })
      mockRefreshUser.mockRejectedValueOnce(new Error('Failed to refresh user'))

      mockLocation.hash = '#id_token=test-id-token&access_token=test-access-token'

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      await waitFor(
        () => {
          expect(
            screen.getByText('Failed to complete authentication. Please try again.')
          ).toBeInTheDocument()
        },
        { timeout: 2000 }
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Success Messages', () => {
    it('should show email confirmed message', () => {
      mockGet.mockImplementation((param: string) => {
        if (param === 'confirmed') return 'true'
        return null
      })

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      expect(
        screen.getByText('Email confirmed successfully! You can now sign in.')
      ).toBeInTheDocument()
    })

    it('should show password reset success message', () => {
      mockGet.mockImplementation((param: string) => {
        if (param === 'reset') return 'success'
        return null
      })

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      expect(
        screen.getByText('Password reset successfully! You can now sign in with your new password.')
      ).toBeInTheDocument()
    })
  })

  describe('Email/Password Sign In', () => {
    it('should handle successful email/password sign in', async () => {
      const user = userEvent.setup()
      ;(authLib.signIn as jest.Mock).mockResolvedValue({
        success: true,
        isSignedIn: true,
      })

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(authLib.signIn).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'TestPass123!',
        })
      })

      expect(mockRefreshUser).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
      expect(mockRefresh).toHaveBeenCalled()
    })

    it('should handle email/password sign in errors', async () => {
      const user = userEvent.setup()
      ;(authLib.signIn as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      })

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'WrongPass')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
      })

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should redirect to returnUrl after successful sign in', async () => {
      const user = userEvent.setup()
      mockGet.mockReset()
      mockGet.mockImplementation((param: string) => {
        if (param === 'returnUrl') return '/dashboard'
        return null
      })
      mockRefreshUser.mockReset()
      mockRefreshUser.mockResolvedValue(undefined)
      ;(authLib.signIn as jest.Mock).mockResolvedValue({
        success: true,
        isSignedIn: true,
      })

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })
})
