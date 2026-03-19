'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MapPin, Search as SearchIcon, Navigation } from 'lucide-react'
import styles from './search.module.css'

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371 // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
}

export default function BranchSearchPage() {
    const router = useRouter()
    const [branches, setBranches] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null)

    useEffect(() => {
        const loadBranches = async () => {
            const { data } = await supabase.from('branches').select('*').eq('is_active', true)
            setBranches(data || [])
            setLoading(false)
        }
        loadBranches()

        // Try geolocation
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.log('Geolocation error:', err)
            )
        }
    }, [])

    const filteredBranches = branches
        .map(b => ({
            ...b,
            distance: userLoc ? calculateDistance(userLoc.lat, userLoc.lng, b.lat, b.lng) : null
        }))
        .filter(b => 
            b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.address.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (a.distance !== null && b.distance !== null) return a.distance - b.distance
            return 0
        })

    const handleBranchClick = async (slug: string) => {
        // v40: Active Tracking
        localStorage.setItem('last_branch_slug', slug);
        
        const stored = localStorage.getItem('liff_customer');
        if (stored) {
            try {
                const customer = JSON.parse(stored);
                if (customer.line_user_id) {
                    // Update DB immediately
                    await supabase
                        .from('customers')
                        .update({ last_branch_slug: slug })
                        .eq('line_user_id', customer.line_user_id);
                    
                    // Update local copy
                    customer.last_branch_slug = slug;
                    localStorage.setItem('liff_customer', JSON.stringify(customer));
                }
            } catch (e) { }
        }
        
        router.push(`/${slug}/menu`);
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <img src="/logo - lanscape.svg" alt="Foami" className={styles.logo} />
                <h1 className={styles.title}>เลือกสาขาใกล้คุณ</h1>
            </div>

            <div className={styles.searchContainer}>
                <div style={{ position: 'relative' }}>
                    <SearchIcon style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                    <input 
                        className={styles.searchInput} 
                        style={{ paddingLeft: 48 }}
                        placeholder="ค้นหาชื่อสาขา หรือ จังหวัด..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>
            ) : (
                <div className={styles.grid}>
                    {filteredBranches.map(b => (
                        <div key={b.id} onClick={() => handleBranchClick(b.slug)} className={styles.branchCard} style={{ cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div className={styles.branchName}>{b.name}</div>
                                {b.distance !== null && (
                                    <div className={styles.distance}>
                                        <Navigation size={12} /> {b.distance.toFixed(1)} กม.
                                    </div>
                                )}
                            </div>
                            <div className={styles.branchAddr}>
                                <MapPin size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {b.address}
                            </div>
                            <div style={{ marginTop: 4 }}>
                                <span className={styles.province}>
                                    {b.address.includes('จ.') ? b.address.split('จ.')[1].split(' ')[0] : (b.address.includes('จังหวัด') ? b.address.split('จังหวัด')[1].split(' ')[0] : 'อื่นๆ')}
                                </span>
                            </div>
                        </div>
                    ))}
                    {filteredBranches.length === 0 && (
                        <div className={styles.empty}>ไม่พบสาขาที่คุณค้นหา</div>
                    )}
                </div>
            )}
        </div>
    )
}
