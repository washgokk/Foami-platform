import { Metadata } from 'next'
import AdminLayoutClient from './AdminLayoutClient'

export const metadata: Metadata = {
  title: 'Foami Admin Portal',
  description: 'ระบบจัดการหลังบ้าน Foami',
  manifest: '/manifest-admin.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon-512x512_admin.png',
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}