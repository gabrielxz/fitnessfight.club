import { render, screen } from '@testing-library/react'
import Home from '@/app/page'

describe('Home Page', () => {
  it('renders the main heading', () => {
    render(<Home />)
    const heading = screen.getByText('Fitness Fight Club')
    expect(heading).toBeInTheDocument()
  })

  it('renders the tagline', () => {
    render(<Home />)
    const tagline = screen.getByText('Track your fitness journey with your Strava club')
    expect(tagline).toBeInTheDocument()
  })

  it('renders Get Started button', () => {
    render(<Home />)
    const button = screen.getByRole('button', { name: /get started/i })
    expect(button).toBeInTheDocument()
  })

  it('renders Learn More button', () => {
    render(<Home />)
    const button = screen.getByRole('button', { name: /learn more/i })
    expect(button).toBeInTheDocument()
  })
})
