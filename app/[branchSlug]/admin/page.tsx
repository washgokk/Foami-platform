import { redirect } from 'next/navigation'

export default function ShopAdminIndex({ params }: { params: { branchSlug: string } }) {
    redirect(/+params.branchSlug+/admin/dashboard)
}