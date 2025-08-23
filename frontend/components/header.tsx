'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'
import { useAuth } from '@/components/auth-provider'
import { LogOut, User } from 'lucide-react'

export function Header() {
  const { user, loading, refreshUser } = useAuth()
  const router = useRouter()

  async function handleSignOut() {
    const result = await signOut()
    if (result.success) {
      await refreshUser()
      router.push('/')
      router.refresh()
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold">Fitness Fight Club</span>
            </Link>

            {user && (
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
            {loading ? (
              <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
            ) : user ? (
              <div className="flex items-center space-x-4">
                <div className="hidden md:flex items-center space-x-2 text-sm">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{user.email || user.username}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/signin">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
