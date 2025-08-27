'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { User } from 'lucide-react'
import { useAuth } from './auth-context'
import { getCognitoAuthUrl, getCognitoSignOutUrl } from '@/lib/auth-client'

export function Header() {
  const { isLoggedIn, signOut } = useAuth()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold">Fitness Fight Club</span>
            </Link>

            {isLoggedIn && (
              <nav className="hidden md:flex items-center space-x-6">
                <Link
                  href="/dashboard"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/activities"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Activities
                </Link>
                <Link
                  href="/challenges"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Challenges
                </Link>
              </nav>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {isLoggedIn ? (
              <div className="flex items-center space-x-4">
                <div className="hidden md:flex items-center space-x-2 text-sm">
                  <User className="h-4 w-4" />
                  <span className="font-medium">User</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    signOut()
                    window.location.href = getCognitoSignOutUrl()
                  }}
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (window.location.href = getCognitoAuthUrl())}
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
