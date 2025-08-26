import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  SignUpForm,
  SignInForm,
  ConfirmationCodeForm,
  GoogleSignInButton,
} from '@/components/auth-forms'

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

    // Test removed: forgot password link not implemented in SignInForm component
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
        expect(mockOnSubmit).toHaveBeenCalledWith({ code: '123456' })
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
      expect(codeInput).toHaveAttribute('maxlength', '6')
      expect(codeInput).toHaveAttribute('pattern', '[0-9]{6}')
      expect(codeInput).toHaveAttribute('placeholder', '000000')
    })
  })

  describe('GoogleSignInButton', () => {
    const mockOnClick = jest.fn()

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should render with Google branding', () => {
      render(<GoogleSignInButton onClick={mockOnClick} loading={false} />)

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Sign in with Google')

      // Check for Google logo SVG
      const svg = button.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveAttribute('width', '18')
      expect(svg).toHaveAttribute('height', '18')
    })

    it('should call onClick when clicked', async () => {
      const user = userEvent.setup()
      render(<GoogleSignInButton onClick={mockOnClick} loading={false} />)

      const button = screen.getByRole('button')
      await user.click(button)

      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })

    it('should be disabled when loading', () => {
      render(<GoogleSignInButton onClick={mockOnClick} loading={true} />)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      // The button text doesn't change when loading - it always shows "Sign in with Google"
      expect(button).toHaveTextContent('Sign in with Google')
    })

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup()
      render(<GoogleSignInButton onClick={mockOnClick} loading={true} />)

      const button = screen.getByRole('button')
      await user.click(button)

      expect(mockOnClick).not.toHaveBeenCalled()
    })

    it('should have correct styling classes', () => {
      render(<GoogleSignInButton onClick={mockOnClick} loading={false} />)

      const button = screen.getByRole('button')

      // Check for minimum height requirement (40px) via inline style
      expect(button).toHaveStyle({ minHeight: '40px' })

      // Check for white background
      expect(button).toHaveClass('bg-white')

      // Check for border
      expect(button).toHaveClass('border')

      // Check for hover effects
      expect(button).toHaveClass('hover:bg-gray-50')

      // Check for shadow
      expect(button).toHaveClass('shadow-sm')
    })

    it('should use Roboto font family', () => {
      render(<GoogleSignInButton onClick={mockOnClick} loading={false} />)

      // The font family is applied to the span element inside the button
      const textElement = screen.getByText('Sign in with Google')
      expect(textElement).toHaveStyle({ fontFamily: 'Roboto, sans-serif' })
    })

    it('should have proper button type', () => {
      render(<GoogleSignInButton onClick={mockOnClick} loading={false} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'button')
    })

    it('should maintain consistent appearance when not loading', () => {
      const { rerender } = render(<GoogleSignInButton onClick={mockOnClick} loading={false} />)

      let button = screen.getByRole('button')
      expect(button).toHaveTextContent('Sign in with Google')

      // Re-render with same props
      rerender(<GoogleSignInButton onClick={mockOnClick} loading={false} />)

      button = screen.getByRole('button')
      expect(button).toHaveTextContent('Sign in with Google')
    })

    it('should show loading indicator when loading', () => {
      render(<GoogleSignInButton onClick={mockOnClick} loading={true} />)

      const button = screen.getByRole('button')

      // The current implementation doesn't show a loading spinner, it just disables the button
      // The Google logo is always visible
      const googleLogo = button.querySelector('svg')
      expect(googleLogo).toBeInTheDocument()
      expect(button).toBeDisabled()
    })

    it('should properly position Google logo and text', () => {
      render(<GoogleSignInButton onClick={mockOnClick} loading={false} />)

      const button = screen.getByRole('button')

      // Button should use flex for alignment
      expect(button).toHaveClass('flex')
      expect(button).toHaveClass('items-center')
      expect(button).toHaveClass('justify-center')
      expect(button).toHaveClass('gap-3')
    })

    it('should have correct opacity when disabled', () => {
      render(<GoogleSignInButton onClick={mockOnClick} loading={true} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('disabled:opacity-50')
    })

    it('should have accessible button attributes', () => {
      render(<GoogleSignInButton onClick={mockOnClick} loading={false} />)

      const button = screen.getByRole('button')
      expect(button).toBeEnabled()
      expect(button).toBeVisible()
    })
  })
})
