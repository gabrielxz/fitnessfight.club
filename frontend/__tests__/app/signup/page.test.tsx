import { render, screen } from '@testing-library/react'
import SignUpPage from '@/app/signup/page'

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  signUp: jest.fn(),
  confirmSignUp: jest.fn(),
  resendConfirmationCode: jest.fn(),
}))
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))
jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  }
})

describe('SignUp Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render sign up page', () => {
    render(<SignUpPage />)
    expect(screen.getByText('Create your account')).toBeInTheDocument()
  })

  it('should have sign in link', () => {
    render(<SignUpPage />)
    expect(screen.getByText(/Already have an account/)).toBeInTheDocument()
  })
})
