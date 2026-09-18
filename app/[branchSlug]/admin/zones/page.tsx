'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export default function ZonesRedirectPage() {
    const params = useParams()
    const router = useRouter()
    const branchSlug = (params?.branchSlug as string) || 'kku'

    useEffect(() => {
        router.replace(`/${branchSlug}/admin/settings?tab=zones`)
    }, [branchSlug, router])

    return (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
            กำลังเปิดหน้าตั้งค่าร้าน & โซนบริการ...
        </div>
    )
}
