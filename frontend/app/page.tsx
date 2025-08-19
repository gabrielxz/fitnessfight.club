import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">Fitness Fight Club</h1>
        <p className="text-center text-muted-foreground">
          Track your fitness journey with your Strava club
        </p>
        <div className="mt-8 flex gap-4 items-center justify-center">
          <Button size="lg">Get Started</Button>
          <Button size="lg" variant="outline">
            Learn More
          </Button>
        </div>
      </div>
    </main>
  )
}
