import { Metadata } from 'next'
import StaffBranchLayoutClient from './StaffBranchLayoutClient'

export const metadata: Metadata = {
  title: 'Staff Portal — Foami',
}

export default async function StaffBranchLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ branchSlug: string }>
}) {
  const { branchSlug } = await params
  return (
    <StaffBranchLayoutClient branchSlug={branchSlug}>
      {children}
    </StaffBranchLayoutClient>
  )
}
