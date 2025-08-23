import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignUpForm, SignInForm, ConfirmationCodeForm } from '@/components/auth-forms'

describe('Auth Forms', () => {
  describe('SignUpForm', () => {
    const mockOnSubmit = jest.fn()

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should render all form fields', () => {
      render(<SignUpForm onSubmit={mockOnSubmit} loading={false} />)

      expect(screen.getByLabelText('Full Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument()
    })

    it('should call onSubmit with form data when submitted', async () => {
      const user = userEvent.setup()
      render(<SignUpForm onSubmit={mockOnSubmit} loading={false} />)

      await user.type(screen.getByLabelText('Full Name'), 'John Doe')
      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')

      await user.click(screen.getByRole('button', { name: 'Sign Up' }))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          fullName: 'John Doe',
          email: 'john@example.com',
          password: 'TestPass123!',
        })
      })
    })

    it('should require all fields', async () => {
      const user = userEvent.setup()
      render(<SignUpForm onSubmit={mockOnSubmit} loading={false} />)

      await user.click(screen.getByRole('button', { name: 'Sign Up' }))

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should validate email format', async () => {
      const user = userEvent.setup()
      render(<SignUpForm onSubmit={mockOnSubmit} loading={false} />)

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement
      await user.type(emailInput, 'invalid-email')

      // Check HTML5 validation
      expect(emailInput.validity.valid).toBe(false)
    })

    it('should disable form when loading', () => {
      render(<SignUpForm onSubmit={mockOnSubmit} loading={true} />)

      expect(screen.getByLabelText('Full Name')).toBeDisabled()
      expect(screen.getByLabelText('Email')).toBeDisabled()
      expect(screen.getByLabelText('Password')).toBeDisabled()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should show loading text when loading', () => {
      render(<SignUpForm onSubmit={mockOnSubmit} loading={true} />)

      expect(screen.getByText('Creating Account...')).toBeInTheDocument()
    })

    it('should have correct input types', () => {
      render(<SignUpForm onSubmit={mockOnSubmit} loading={false} />)

      expect(screen.getByLabelText('Full Name')).toHaveAttribute('type', 'text')
      expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    })
  })

  describe('SignInForm', () => {
    const mockOnSubmit = jest.fn()

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should render all form fields', () => {
      render(<SignInForm onSubmit={mockOnSubmit} loading={false} />)

      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    })

    it('should call onSubmit with form data when submitted', async () => {
      const user = userEvent.setup()
      render(<SignInForm onSubmit={mockOnSubmit} loading={false} />)

      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.type(screen.getByLabelText('Password'), 'TestPass123!')

      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          email: 'john@example.com',
          password: 'TestPass123!',
        })
      })
    })

    it('should require all fields', async () => {
      const user = userEvent.setup()
      render(<SignInForm onSubmit={mockOnSubmit} loading={false} />)

      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should disable form when loading', () => {
      render(<SignInForm onSubmit={mockOnSubmit} loading={true} />)

      expect(screen.getByLabelText('Email')).toBeDisabled()
      expect(screen.getByLabelText('Password')).toBeDisabled()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should show loading text when loading', () => {
      render(<SignInForm onSubmit={mockOnSubmit} loading={true} />)

      expect(screen.getByText('Signing In...')).toBeInTheDocument()
    })

    it('should have correct input types', () => {
      render(<SignInForm onSubmit={mockOnSubmit} loading={false} />)

      expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    })

    it('should show forgot password link', () => {
      render(<SignInForm onSubmit={mockOnSubmit} loading={false} />)

      const forgotPasswordLink = screen.getByText('Forgot your password?')
      expect(forgotPasswordLink).toBeInTheDocument()
      expect(forgotPasswordLink.closest('a')).toHaveAttribute('href', '/reset-password')
    })
  })

  describe('ConfirmationCodeForm', () => {
    const mockOnSubmit = jest.fn()
    const mockOnResend = jest.fn()

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should render all form elements', () => {
      render(
        <ConfirmationCodeForm onSubmit={mockOnSubmit} onResend={mockOnResend} loading={false} />
      )

      expect(screen.getByLabelText('Confirmation Code')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Verify Email' })).toBeInTheDocument()
      expect(screen.getByText(/Didn't receive a code\? Resend/)).toBeInTheDocument()
    })

    it('should show helpful instructions', () => {
      render(
        <ConfirmationCodeForm onSubmit={mockOnSubmit} onResend={mockOnResend} loading={false} />
      )

      expect(screen.getByText(/Enter the 6-digit code/)).toBeInTheDocument()
    })

    it('should call onSubmit with code when submitted', async () => {
      const user = userEvent.setup()
      render(
        <ConfirmationCodeForm onSubmit={mockOnSubmit} onResend={mockOnResend} loading={false} />
      )

      await user.type(screen.getByLabelText('Confirmation Code'), '123456')
      await user.click(screen.getByRole('button', { name: 'Verify Email' }))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('123456')
      })
    })

    it('should require code field', async () => {
      const user = userEvent.setup()
      render(
        <ConfirmationCodeForm onSubmit={mockOnSubmit} onResend={mockOnResend} loading={false} />
      )

      await user.click(screen.getByRole('button', { name: 'Verify Email' }))

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should call onResend when resend button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <ConfirmationCodeForm onSubmit={mockOnSubmit} onResend={mockOnResend} loading={false} />
      )

      await user.click(screen.getByText(/Didn't receive a code\? Resend/))

      expect(mockOnResend).toHaveBeenCalled()
    })

    it('should disable form when loading', () => {
      render(
        <ConfirmationCodeForm onSubmit={mockOnSubmit} onResend={mockOnResend} loading={true} />
      )

      expect(screen.getByLabelText('Confirmation Code')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Verifying...' })).toBeDisabled()
      expect(screen.getByText(/Didn't receive a code\? Resend/)).toHaveAttribute('disabled')
    })

    it('should show loading text when loading', () => {
      render(
        <ConfirmationCodeForm onSubmit={mockOnSubmit} onResend={mockOnResend} loading={true} />
      )

      expect(screen.getByText('Verifying...')).toBeInTheDocument()
    })

    it('should have correct input attributes', () => {
      render(
        <ConfirmationCodeForm onSubmit={mockOnSubmit} onResend={mockOnResend} loading={false} />
      )

      const codeInput = screen.getByLabelText('Confirmation Code')
      expect(codeInput).toHaveAttribute('type', 'text')
      expect(codeInput).toHaveAttribute('inputMode', 'numeric')
      expect(codeInput).toHaveAttribute('autoComplete', 'one-time-code')
      expect(codeInput).toHaveAttribute('maxLength', '6')
    })
  })
})
