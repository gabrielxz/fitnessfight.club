import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Header } from '@/components/header'
import { signOut, getCurrentUser } from '@/lib/auth'
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

describe('Header Component', () => {
  const mockPush = jest.fn()
  const mockRefresh = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    })
  })

  describe('Unauthenticated State', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockRejectedValue(new Error('Not authenticated'))
    })

    it('should render logo and title', async () => {
      render(<Header />)

      await waitFor(() => {
        expect(screen.getByText('Fitness Fight Club')).toBeInTheDocument()
      })
    })

    it('should show Sign In and Sign Up buttons when not authenticated', async () => {
      render(<Header />)

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument()
        expect(screen.getByText('Sign Up')).toBeInTheDocument()
      })
    })

    it('should not show navigation links when not authenticated', async () => {
      render(<Header />)

      await waitFor(() => {
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
        expect(screen.queryByText('Activities')).not.toBeInTheDocument()
        expect(screen.queryByText('Challenges')).not.toBeInTheDocument()
      })
    })

    it('should not show user email or Sign Out button', async () => {
      render(<Header />)

      await waitFor(() => {
        expect(screen.queryByText('Sign Out')).not.toBeInTheDocument()
        expect(screen.queryByText(/test@example.com/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Authenticated State', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue({
        username: 'test@example.com',
        userId: 'cognito-123',
        signInDetails: {
          loginId: 'test@example.com',
        },
      })
    })

    it('should show navigation links when authenticated', async () => {
      render(<Header />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Activities')).toBeInTheDocument()
        expect(screen.getByText('Challenges')).toBeInTheDocument()
      })
    })

    it('should show user email when authenticated', async () => {
      render(<Header />)

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })
    })

    it('should show Sign Out button when authenticated', async () => {
      render(<Header />)

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })
    })

    it('should not show Sign In and Sign Up buttons when authenticated', async () => {
      render(<Header />)

      await waitFor(() => {
        expect(screen.queryByText('Sign In')).not.toBeInTheDocument()
        expect(screen.queryByText('Sign Up')).not.toBeInTheDocument()
      })
    })

    it('should handle sign out when Sign Out button is clicked', async () => {
      ;(signOut as jest.Mock).mockResolvedValue({ success: true })

      render(<Header />)

      // Wait for the component to finish loading
      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })

      const signOutButton = screen.getByText('Sign Out')
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(signOut).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/')
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('should handle sign out error gracefully', async () => {
      ;(signOut as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Sign out failed',
      })
      jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<Header />)

      // Wait for the component to finish loading
      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })

      const signOutButton = screen.getByText('Sign Out')
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(signOut).toHaveBeenCalled()
      })

      // Router should not be called on error
      expect(mockPush).not.toHaveBeenCalled()
      expect(mockRefresh).not.toHaveBeenCalled()

      jest.restoreAllMocks()
    })
  })

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      ;(getCurrentUser as jest.Mock).mockImplementation(() => new Promise(() => {}))

      const { container } = render(<Header />)

      // Should show loading skeleton
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    beforeEach(() => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue({
        username: 'test@example.com',
        userId: 'cognito-123',
        signInDetails: {
          loginId: 'test@example.com',
        },
      })
    })

    it('should render correct href for navigation links', async () => {
      render(<Header />)

      await waitFor(() => {
        const dashboardLink = screen.getByText('Dashboard').closest('a')
        const activitiesLink = screen.getByText('Activities').closest('a')
        const challengesLink = screen.getByText('Challenges').closest('a')

        expect(dashboardLink).toHaveAttribute('href', '/dashboard')
        expect(activitiesLink).toHaveAttribute('href', '/activities')
        expect(challengesLink).toHaveAttribute('href', '/challenges')
      })
    })

    it('should render correct href for auth buttons', async () => {
      ;(getCurrentUser as jest.Mock).mockRejectedValue(new Error('Not authenticated'))

      render(<Header />)

      await waitFor(() => {
        const signInLink = screen.getByText('Sign In').closest('a')
        const signUpLink = screen.getByText('Sign Up').closest('a')

        expect(signInLink).toHaveAttribute('href', '/signin')
        expect(signUpLink).toHaveAttribute('href', '/signup')
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('should have fixed positioning classes', () => {
      render(<Header />)

      const header = screen.getByRole('banner')
      expect(header).toHaveClass('fixed', 'top-0', 'left-0', 'right-0', 'z-50')
    })

    it('should have proper styling classes', () => {
      render(<Header />)

      const header = screen.getByRole('banner')
      expect(header).toHaveClass('border-b')
    })
  })
})
