import { Metadata } from 'next'
import AdminLayoutClient from './AdminLayoutClient'

export const metadata: Metadata = {
  title: 'Foami Admin Portal',
  description: 'ระบบจัดการหลังบ้าน Foami',
  manifest: '/manifest-admin.json',
  icons: {
    icon: '/icon-192x192_admin.png',
    apple: '/icon-192x192_admin.png',
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
