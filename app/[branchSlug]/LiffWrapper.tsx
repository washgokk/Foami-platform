'use client'
import { usePathname } from 'next/navigation'

export default function LiffWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.includes('/admin')

  if (isAdmin) {
    return <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)' }}>{children}</div>
  }

  return (
    <div className="liff-root">
      {children}
    </div>
  )
}
