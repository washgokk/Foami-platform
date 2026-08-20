import { redirect } from 'next/navigation'

export default async function ShopAdminIndex({ params }: { params: Promise<{ branchSlug: string }> }) {
    const { branchSlug } = await params
    redirect(`/${branchSlug}/admin/dashboard`)
}