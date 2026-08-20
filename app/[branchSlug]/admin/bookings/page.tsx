'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AdminBookingsPage from '@/app/admin/bookings/page'

// B2 FIX: Wrapper that resolves branchSlug → branchId and passes it to AdminBookingsPage
export default function ShopBookingsPage() {
    const params = useParams()
    const branchSlug = params?.branchSlug as string
    const [branchId, setBranchId] = useState<string | null>(null)

    useEffect(() => {
        if (!branchSlug) return
        supabase.from('branches').select('id').eq('slug', branchSlug).maybeSingle()
            .then(({ data }) => { if (data) setBranchId(data.id) })
    }, [branchSlug])

    if (!branchId) return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <span className="spinner" /> กำลังโหลด...
        </div>
    )

    return <AdminBookingsPage branchId={branchId} />
}
