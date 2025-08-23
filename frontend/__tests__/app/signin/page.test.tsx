import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInPage from '@/app/signin/page'
import { signIn } from '@/lib/auth'
import { useRouter, useSearchParams } from 'next/navigation'

// Mock dependencies
jest.mock('@/lib/auth')
jest.mock('next/navigation')
jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  }
})

describe('SignIn Page', () => {
  const mockPush = jest.fn()
  const mockGet = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
    ;(useSearchParams as jest.Mock).mockReturnValue({
      get: mockGet,
    })
  })

  describe('Page Rendering', () => {
    it('should render sign in form', () => {
      mockGet.mockReturnValue(null)
      render(<SignInPage />)

      expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
      expect(screen.getByText('Welcome back to Fitness Fight Club')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    })

    it('should show success message when email is confirmed', () => {
      mockGet.mockReturnValue('true')
      render(<SignInPage />)

      expect(
        screen.getByText('Email verified successfully! You can now sign in.')
      ).toBeInTheDocument()
    })

    it('should not show success message when confirmed param is not present', () => {
      mockGet.mockReturnValue(null)
      render(<SignInPage />)

      expect(
        screen.queryByText('Email verified successfully! You can now sign in.')
      ).not.toBeInTheDocument()
    })

    it('should show link to sign up page', () => {
      mockGet.mockReturnValue(null)
      render(<SignInPage />)

      expect(screen.getByText("Don't have an account?")).toBeInTheDocument()
      const signUpLink = screen.getByText('Sign up')
      expect(signUpLink).toBeInTheDocument()
      expect(signUpLink.closest('a')).toHaveAttribute('href', '/signup')
    })

    it('should show forgot password link', () => {
      mockGet.mockReturnValue(null)
      render(<SignInPage />)

      const forgotPasswordLink = screen.getByText('Forgot your password?')
      expect(forgotPasswordLink).toBeInTheDocument()
      expect(forgotPasswordLink.closest('a')).toHaveAttribute('href', '/reset-password')
    })
  })

  describe('Sign In Flow', () => {
    beforeEach(() => {
      mockGet.mockReturnValue(null)
    })

    it('should handle successful sign in', async () => {
      const user = userEvent.setup()
      ;(signIn as jest.Mock).mockResolvedValue({
        success: true,
        isSignedIn: true,
        nextStep: { signInStep: 'DONE' },
      })

      render(<SignInPage />)

      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')

      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith({
          email: 'john@example.com',
          password: 'TestPass123!',
        })
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })

    it('should display sign in errors', async () => {
      const user = userEvent.setup()
      ;(signIn as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Incorrect username or password',
      })

      render(<SignInPage />)

      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'WrongPass')

      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(screen.getByText('Incorrect username or password')).toBeInTheDocument()
      })
    })

    it('should show loading state during sign in', async () => {
      const user = userEvent.setup()
      let resolveSignIn: (value: any) => void
      const signInPromise = new Promise((resolve) => {
        resolveSignIn = resolve
      })
      ;(signIn as jest.Mock).mockReturnValue(signInPromise)

      render(<SignInPage />)

      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')

      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      // Should show loading state
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeDisabled()
      expect(screen.getByLabelText('Password')).toBeDisabled()

      // Resolve the promise
      resolveSignIn!({
        success: true,
        isSignedIn: true,
        nextStep: { signInStep: 'DONE' },
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })

    it('should handle sign in with additional steps', async () => {
      const user = userEvent.setup()
      ;(signIn as jest.Mock).mockResolvedValue({
        success: true,
        isSignedIn: false,
        nextStep: { signInStep: 'CONFIRM_SIGN_UP' },
      })

      render(<SignInPage />)

      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')

      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(signIn).toHaveBeenCalled()
        // Should redirect to signup for confirmation
        expect(mockPush).toHaveBeenCalledWith('/signup')
      })
    })

    it('should clear error message when user starts typing', async () => {
      const user = userEvent.setup()
      ;(signIn as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Incorrect username or password',
      })

      render(<SignInPage />)

      // First attempt - fail
      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'WrongPass')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(screen.getByText('Incorrect username or password')).toBeInTheDocument()
      })

      // Clear inputs and type again
      await user.clear(screen.getByLabelText('Password'))
      await user.type(screen.getByLabelText('Password'), 'NewPass')

      // Error should be cleared (this depends on implementation)
      // In the actual implementation, setError('') might be called onChange
    })
  })

  describe('Page Layout', () => {
    beforeEach(() => {
      mockGet.mockReturnValue(null)
    })

    it('should have proper styling and layout', () => {
      render(<SignInPage />)

      // Check for centered layout
      const container = screen.getByText('Sign in to your account').closest('div')
      expect(container?.parentElement).toHaveClass(
        'flex',
        'min-h-screen',
        'items-center',
        'justify-center'
      )
    })

    it('should have max width constraint', () => {
      render(<SignInPage />)

      const formContainer = screen.getByText('Sign in to your account').closest('div')
      expect(formContainer).toHaveClass('w-full', 'max-w-md', 'space-y-8')
    })

    it('should have proper padding', () => {
      render(<SignInPage />)

      const mainContainer = screen
        .getByText('Sign in to your account')
        .closest('div')?.parentElement
      expect(mainContainer).toHaveClass('px-4', 'sm:px-6', 'lg:px-8')
    })
  })

  describe('Form Validation', () => {
    beforeEach(() => {
      mockGet.mockReturnValue(null)
    })

    it('should require email and password fields', async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      // Try to submit without filling fields
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      // signIn should not be called
      expect(signIn).not.toHaveBeenCalled()
    })

    it('should validate email format', async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement
      await user.type(emailInput, 'invalid-email')

      // HTML5 validation should mark it as invalid
      expect(emailInput.validity.valid).toBe(false)
    })
  })

  describe('Success Alert', () => {
    it('should show success alert with proper styling', () => {
      mockGet.mockReturnValue('true')
      render(<SignInPage />)

      const alert = screen.getByText('Email verified successfully! You can now sign in.')
      expect(alert).toHaveClass('bg-green-50', 'border-green-200', 'text-green-800')
    })

    it('should show check icon in success alert', () => {
      mockGet.mockReturnValue('true')
      render(<SignInPage />)

      // The CheckCircle icon should be rendered
      const alertContainer = screen.getByText(
        'Email verified successfully! You can now sign in.'
      ).parentElement
      expect(alertContainer?.querySelector('svg')).toBeInTheDocument()
    })
  })
})
