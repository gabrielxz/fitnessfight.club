import { render, screen } from '@testing-library/react'
import SignInPage from '@/app/signin/page'

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  signIn: jest.fn(),
}))
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => ({ get: jest.fn() })),
}))
jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  }
})

describe('SignIn Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render sign in page', () => {
    render(<SignInPage />)
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
  })

  it('should have sign up link', () => {
    render(<SignInPage />)
    expect(screen.getByText(/Don't have an account/)).toBeInTheDocument()
  })
})
