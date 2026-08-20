import { Metadata } from 'next'
import PlatformLayoutClient from './PlatformLayoutClient'

export const metadata: Metadata = {
  title: 'Platform Admin — Foami',
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformLayoutClient>{children}</PlatformLayoutClient>
}
