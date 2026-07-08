import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Living World',
  description: 'TTRPG campaign companion — living world, dynamic jobs, real consequences.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-950 text-white">
        {children}
      </body>
    </html>
  )
}