import { render, screen } from '@testing-library/react'
import Home from '@/app/page'
import { AuthProvider } from '@/components/auth-provider'

// Mock auth dependencies
jest.mock('@/lib/auth')

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the main heading', () => {
    render(
      <AuthProvider>
        <Home />
      </AuthProvider>
    )
    const heading = screen.getByText('Fitness Fight Club')
    expect(heading).toBeInTheDocument()
  })

  it('renders the tagline', () => {
    render(
      <AuthProvider>
        <Home />
      </AuthProvider>
    )
    const tagline = screen.getByText('Track your fitness journey with your Strava club')
    expect(tagline).toBeInTheDocument()
  })

  it('renders the main image', () => {
    render(
      <AuthProvider>
        <Home />
      </AuthProvider>
    )
    const image = screen.getByAltText('Fitness Fight Club')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', expect.stringContaining('ffcww2.png'))
  })
})
