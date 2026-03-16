import { Metadata } from 'next'
import StaffLayoutClient from './StaffLayoutClient'

export const metadata: Metadata = {
  title: 'Foami Staff Portal',
  description: 'ระบบพนักงาน Foami สำหรับรับงาน',
  manifest: '/manifest-staff.json',
  icons: {
    icon: '/icon-192x192_staff.png',
    apple: '/icon-192x192_staff.png',
  },
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffLayoutClient>{children}</StaffLayoutClient>
}
