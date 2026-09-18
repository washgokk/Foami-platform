import PlatformLayoutClient from './PlatformLayoutClient'

export const metadata = {
  title: 'Foami Platform HQ — Super Admin',
  description: 'Foami Car Wash & Delivery Platform Management',
}

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return <PlatformLayoutClient>{children}</PlatformLayoutClient>
}
