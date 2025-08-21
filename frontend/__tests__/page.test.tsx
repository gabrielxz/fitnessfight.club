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

  it('renders the main image', () => {
    render(<Home />)
    const image = screen.getByAltText('Fitness Fight Club')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', expect.stringContaining('ffcww2.png'))
  })
})
