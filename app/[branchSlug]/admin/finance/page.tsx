'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminFinancePage from '@/app/admin/finance/page'

export default function ShopFinancePage() {
    const params = useParams()
    const branchSlug = params?.branchSlug as string
    const [branchId, setBranchId] = useState<string | null>(null)
    useEffect(() => {
        if (!branchSlug) return
        supabase.from('branches').select('id').eq('slug', branchSlug).maybeSingle()
            .then(({ data }) => { if (data) setBranchId(data.id) })
    }, [branchSlug])
    if (!branchId) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลด...</div>
    return <AdminFinancePage branchId={branchId} />
}