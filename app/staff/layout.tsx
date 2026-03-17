import { Metadata } from 'next'
import StaffLayoutClient from './StaffLayoutClient'

export const metadata: Metadata = {
  title: 'Foami Staff Portal',
  description: 'ระบบพนักงาน Foami สำหรับรับงาน',
  manifest: '/manifest-staff.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffLayoutClient>{children}</StaffLayoutClient>
}
