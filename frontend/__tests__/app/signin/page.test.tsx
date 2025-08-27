import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInPage from '@/app/signin/page'
import { AuthProvider } from '@/components/auth-provider'
import * as authLib from '@/lib/auth'

// Mock dependencies
const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockGet = jest.fn()
const mockRefreshUser = jest.fn().mockResolvedValue(undefined)

jest.mock('@/lib/auth', () => ({
  federatedSignIn: jest.fn(),
  getCurrentUser: jest.fn(() => Promise.resolve(null)),
}))

jest.mock('@/lib/cognito-client', () => ({
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
  ancestorOrigins: {
    length: 0,
    item: jest.fn(),
    contains: jest.fn(),
  } as unknown as DOMStringList,
}

// Mock window.location safely using defineProperty with try-catch
try {
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: mockLocation,
  })
} catch {
  // If window.location is already defined and not configurable, skip mocking
  // This can happen in different test environments
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
    it('should handle OAuth error in URL parameters', async () => {
      mockGet.mockImplementation((param: string) => {
        if (param === 'error') return 'access_denied'
        return null
      })

      render(
        <AuthProvider>
          <SignInPage />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('access_denied')).toBeInTheDocument()
      })
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
})
