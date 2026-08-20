import { Metadata } from 'next'
import ShopAdminLayoutClient from './ShopAdminLayoutClient'

export const metadata: Metadata = {
  title: 'Shop Admin — Foami',
}

export default function ShopAdminLayout({ children }: { children: React.ReactNode }) {
  return <ShopAdminLayoutClient>{children}</ShopAdminLayoutClient>
}
