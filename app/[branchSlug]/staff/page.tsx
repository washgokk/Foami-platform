import { redirect } from 'next/navigation'

export default async function StaffPage({ params }: { params: Promise<{ branchSlug: string }> }) {
  const { branchSlug } = await params
  redirect(`/${branchSlug}/staff/dashboard`)
}
