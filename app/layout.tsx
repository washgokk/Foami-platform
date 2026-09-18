import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { LiffProvider } from '@/components/Providers/LiffProvider'
import NotificationPermission from '@/components/Global/NotificationPermission'

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
    icon: '/icon.svg',
    apple: '/icon-512x512_user.png',
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
        {/* Microsoft Clarity - User Listening, Heatmaps & Session Recording */}
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_ID || 'q3f0g8w9'}");
          `}
        </Script>
        
        <LiffProvider liffId={liffId}>
          <NotificationPermission />
          {children}
        </LiffProvider>
      </body>
    </html>
  )
}
