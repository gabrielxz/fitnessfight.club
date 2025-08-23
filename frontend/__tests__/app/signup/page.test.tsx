import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignUpPage from '@/app/signup/page'
import { signUp, confirmSignUpCode, resendConfirmationCode } from '@/lib/auth'
import { useRouter } from 'next/navigation'

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

describe('SignUp Page', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
  })

  describe('Sign Up Step', () => {
    it('should render sign up form initially', () => {
      render(<SignUpPage />)

      expect(screen.getByText('Create your account')).toBeInTheDocument()
      expect(screen.getByText('Sign up to get started with Fitness Fight Club')).toBeInTheDocument()
      expect(screen.getByLabelText('Full Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('should show link to sign in page', () => {
      render(<SignUpPage />)

      const signInLink = screen.getByText('Sign in')
      expect(signInLink).toBeInTheDocument()
      expect(signInLink.closest('a')).toHaveAttribute('href', '/signin')
    })

    it('should handle successful sign up', async () => {
      const user = userEvent.setup()
      ;(signUp as jest.Mock).mockResolvedValue({
        success: true,
        isSignUpComplete: false,
        userId: 'test-user-id',
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
      })

      render(<SignUpPage />)

      await user.type(screen.getByLabelText('Full Name'), 'John Doe')
      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')

      await user.click(screen.getByRole('button', { name: 'Sign Up' }))

      await waitFor(() => {
        expect(signUp).toHaveBeenCalledWith({
          email: 'john@example.com',
          password: 'TestPass123!',
          fullName: 'John Doe',
        })

        // Should show confirmation form
        expect(screen.getByText('Verify your email')).toBeInTheDocument()
        expect(screen.getByLabelText('Verification Code')).toBeInTheDocument()
      })
    })

    it('should display sign up errors', async () => {
      const user = userEvent.setup()
      ;(signUp as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Username already exists',
      })

      render(<SignUpPage />)

      await user.type(screen.getByLabelText('Full Name'), 'John Doe')
      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')

      await user.click(screen.getByRole('button', { name: 'Sign Up' }))

      await waitFor(() => {
        expect(screen.getByText('Username already exists')).toBeInTheDocument()
      })
    })

    it('should show loading state during sign up', async () => {
      const user = userEvent.setup()
      let resolveSignUp: (value: any) => void
      const signUpPromise = new Promise((resolve) => {
        resolveSignUp = resolve
      })
      ;(signUp as jest.Mock).mockReturnValue(signUpPromise)

      render(<SignUpPage />)

      await user.type(screen.getByLabelText('Full Name'), 'John Doe')
      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')

      await user.click(screen.getByRole('button', { name: 'Sign Up' }))

      // Should show loading state
      expect(screen.getByText('Creating account...')).toBeInTheDocument()

      // Resolve the promise
      resolveSignUp!({
        success: true,
        isSignUpComplete: false,
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
      })

      await waitFor(() => {
        expect(screen.queryByText('Creating account...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Confirmation Step', () => {
    beforeEach(async () => {
      const user = userEvent.setup()
      ;(signUp as jest.Mock).mockResolvedValue({
        success: true,
        isSignUpComplete: false,
        userId: 'test-user-id',
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
      })

      render(<SignUpPage />)

      // Complete sign up to get to confirmation step
      await user.type(screen.getByLabelText('Full Name'), 'John Doe')
      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')
      await user.click(screen.getByRole('button', { name: 'Sign Up' }))

      await waitFor(() => {
        expect(screen.getByText('Verify your email')).toBeInTheDocument()
      })
    })

    it('should show confirmation form after sign up', () => {
      expect(screen.getByText('Verify your email')).toBeInTheDocument()
      expect(screen.getByText(/john@example.com/)).toBeInTheDocument()
      expect(screen.getByLabelText('Verification Code')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Verify Email' })).toBeInTheDocument()
    })

    it('should handle successful confirmation', async () => {
      const user = userEvent.setup()
      ;(confirmSignUpCode as jest.Mock).mockResolvedValue({
        success: true,
        isSignUpComplete: true,
        nextStep: { signUpStep: 'DONE' },
      })

      await user.type(screen.getByLabelText('Verification Code'), '123456')
      await user.click(screen.getByRole('button', { name: 'Verify Email' }))

      await waitFor(() => {
        expect(confirmSignUpCode).toHaveBeenCalledWith('john@example.com', '123456')
        expect(mockPush).toHaveBeenCalledWith('/signin?confirmed=true')
      })
    })

    it('should display confirmation errors', async () => {
      const user = userEvent.setup()
      ;(confirmSignUpCode as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Invalid verification code',
      })

      await user.type(screen.getByLabelText('Verification Code'), '000000')
      await user.click(screen.getByRole('button', { name: 'Verify Email' }))

      await waitFor(() => {
        expect(screen.getByText('Invalid verification code')).toBeInTheDocument()
      })
    })

    it('should handle resend code', async () => {
      const user = userEvent.setup()
      ;(resendConfirmationCode as jest.Mock).mockResolvedValue({
        success: true,
      })

      await user.click(screen.getByRole('button', { name: /Resend code/i }))

      await waitFor(() => {
        expect(resendConfirmationCode).toHaveBeenCalledWith('john@example.com')
        expect(screen.getByText('Verification code sent!')).toBeInTheDocument()
      })
    })

    it('should handle resend code error', async () => {
      const user = userEvent.setup()
      ;(resendConfirmationCode as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to resend code',
      })

      await user.click(screen.getByRole('button', { name: /Resend code/i }))

      await waitFor(() => {
        expect(screen.getByText('Failed to resend code')).toBeInTheDocument()
      })
    })

    it('should show loading state during confirmation', async () => {
      const user = userEvent.setup()
      let resolveConfirm: (value: any) => void
      const confirmPromise = new Promise((resolve) => {
        resolveConfirm = resolve
      })
      ;(confirmSignUpCode as jest.Mock).mockReturnValue(confirmPromise)

      await user.type(screen.getByLabelText('Verification Code'), '123456')
      await user.click(screen.getByRole('button', { name: 'Verify Email' }))

      // Should show loading state
      expect(screen.getByText('Verifying...')).toBeInTheDocument()

      // Resolve the promise
      resolveConfirm!({
        success: true,
        isSignUpComplete: true,
        nextStep: { signUpStep: 'DONE' },
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signin?confirmed=true')
      })
    })
  })

  describe('Page Layout', () => {
    it('should have proper styling and layout', () => {
      render(<SignUpPage />)

      // Check for centered layout
      const container = screen.getByText('Create your account').closest('div')
      expect(container?.parentElement).toHaveClass(
        'flex',
        'min-h-screen',
        'items-center',
        'justify-center'
      )
    })

    it('should have max width constraint', () => {
      render(<SignUpPage />)

      const formContainer = screen.getByText('Create your account').closest('div')
      expect(formContainer).toHaveClass('w-full', 'max-w-md', 'space-y-8')
    })
  })
})
