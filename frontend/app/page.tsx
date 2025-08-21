import Image from 'next/image'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">Fitness Fight Club</h1>
        <p className="text-center text-muted-foreground mb-8">
          Track your fitness journey with your Strava club
        </p>
        <div className="mt-8 flex items-center justify-center">
          <Image
            src="/ffcww2.png"
            alt="Fitness Fight Club"
            width={600}
            height={400}
            className="rounded-lg shadow-lg"
            priority
          />
        </div>
      </div>
    </main>
  )
}
