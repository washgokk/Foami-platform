import { redirect } from 'next/navigation'

export default function StaffPage({ params }: { params: { branchSlug: string } }) {
  redirect(`/${params.branchSlug}/staff/dashboard`)
}
