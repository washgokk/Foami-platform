import type { Metadata, Viewport } from 'next'
import './globals.css'
import MockDbToggle from '@/components/MockDbToggle'
import { LiffProvider } from '@/components/Providers/LiffProvider'

export const viewport: Viewport = {
  themeColor: '#ffffff',
}

export const metadata: Metadata = {
  title: 'Foami Wash & Delivery',
  description: 'บริการล้างมอเตอร์ไซค์ รับ-ส่งถึงบ้าน',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Foami',
  },
  icons: {
    icon: '/icon-192x192_user.png',
    apple: '/icon-192x192_user.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID || ''

  return (
    <html lang="th" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LiffProvider liffId={liffId}>
          {children}
        </LiffProvider>
        <MockDbToggle />
      </body>
    </html>
  )
}
