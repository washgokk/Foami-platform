'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_CSS, BookingStatus } from '@/lib/types'
import styles from './dashboard.module.css'
import { ShoppingBag, Calendar, Clock, Star, MapPin, ChevronRight, CheckCircle, AlertCircle, Sparkles, Info, HelpCircle } from 'lucide-react'

// ─── Haversine distance (km) ─────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Utility to extract place name from address ─────────────
function getPlaceName(addr: string) {
    if (!addr) return 'ไม่ระบุสถานที่'
    // Format: "Detail (Note) Address" -> take Detail
    const parts = addr.split('(')
    if (parts.length > 1) return parts[0].trim()
    // Fallback: take first two words if too long
    const words = addr.split(' ')
    if (words.length > 2) return words.slice(0, 2).join(' ')
    return addr
}

export default function StaffDashboard() {
    const [jobs, setJobs] = useState<any[]>([])
    const [availableJobs, setAvailableJobs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [confirmingJob, setConfirmingJob] = useState<any>(null)
    const [staffId, setStaffId] = useState('')
    const router = useRouter()

    // E2 FIX: Auth guard
    useEffect(() => {
        const token = localStorage.getItem('staff_token')
        if (!token) { router.replace('/staff/login'); return }
        try {
            const info = JSON.parse(localStorage.getItem('staff_info') || '{}')
            if (info?.id) setStaffId(info.id)
        } catch (e) {}
    }, [router])
    const [staffZones, setStaffZones] = useState<string[]>([])
    const now = new Date()
    const thDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
    const today = thDate.getFullYear() + '-' + String(thDate.getMonth() + 1).padStart(2, '0') + '-' + String(thDate.getDate()).padStart(2, '0')

    const load = useCallback(async () => {
        if (!staffId) return
        setLoading(true)
        try {
            // 1. Fetch Basic Information (including branch_id)
            const { data: staffData } = await supabase.from('staff').select('branch_id').eq('id', staffId).single()
            const { data: allBranches } = await supabase.from('branches').select('id, lat, lng')
            const { data: allStaff } = await supabase.from('staff').select('id, branch_id')
            
            const branchId = staffData?.branch_id

            // 2. Fetch ALL on-duty schedules for benchmarking suitability
            const { data: dutySchedules } = await supabase
                .from('staff_schedules')
                .select('staff_id, date, time_slot, zone_id, is_booked')
                .gte('date', today)
            
            const mySchedules = (dutySchedules || []).filter(s => s.staff_id === staffId && !s.is_booked)
            const myAvailableSlots = mySchedules.map(s => `${s.date}_${(s.time_slot || '').slice(0, 5)}`)
            const uniqueZones = Array.from(new Set(mySchedules.map(s => s.zone_id)))
            setStaffZones(uniqueZones)

            // 3. Fetch Assigned Jobs (Assigned specifically to this staff)
            const { data: assignedData } = await supabase
                .from('bookings')
                .select('*, customers(full_name, phone, vehicle_brand, vehicle_model, license_plate, vehicle_size), services(name), zones(name)')
                .eq('staff_id', staffId)
                .not('status', 'in', '(completed,cancelled)')
                .order('scheduled_date', { ascending: true })
                .order('scheduled_time', { ascending: true })
            // --- Manual Joins Fallback (Mock DB) ---
            const resolveRelations = async (bData: any[]) => {
                const sIds = [...new Set(bData.filter(b => b.service_id).map(b => b.service_id))]
                const zIds = [...new Set(bData.filter(b => b.zone_id).map(b => b.zone_id))]
                const cIds = [...new Set(bData.filter(b => b.customer_id).map(b => b.customer_id))]

                if (sIds.length > 0) {
                    const { data: sData } = await supabase.from('services').select('*').in('id', sIds)
                    const smap = Object.fromEntries(sData?.map((s: any) => [s.id, s]) || [])
                    bData.forEach(b => { if (b.service_id) b.services = smap[b.service_id] })
                }
                if (zIds.length > 0) {
                    const { data: zData } = await supabase.from('zones').select('*').in('id', zIds)
                    const zmap = Object.fromEntries(zData?.map((z: any) => [z.id, z]) || [])
                    bData.forEach(b => { if (b.zone_id) b.zones = zmap[b.zone_id] })
                }
                if (cIds.length > 0) {
                    const { data: cData } = await supabase.from('customers').select('*').in('id', cIds)
                    const cmap = Object.fromEntries(cData?.map((c: any) => [c.id, c]) || [])
                    bData.forEach(b => { if (b.customer_id) b.customers = cmap[b.customer_id] })
                }
                return bData
            }

            const finalAssigned = await resolveRelations(assignedData || [])
            setJobs([...finalAssigned])

            // 4. Fetch Available Jobs (Marketplace)
            let marketQuery = supabase
                .from('bookings')
                .select('*, customers(full_name, phone, vehicle_brand, vehicle_model, license_plate, vehicle_size), services(name), zones(name)')
                .is('staff_id', null)
                .eq('status', 'pending')
                .gte('scheduled_date', today)

            if (branchId && uniqueZones.length > 0) {
                marketQuery = marketQuery.or(`branch_id.eq.${branchId},zone_id.in.(${uniqueZones.join(',')})`)
            } else if (branchId) {
                marketQuery = marketQuery.eq('branch_id', branchId)
            } else if (uniqueZones.length > 0) {
                marketQuery = marketQuery.in('zone_id', uniqueZones)
            }

            const { data: marketData, error: marketError } = await marketQuery
                .order('scheduled_date', { ascending: true })
                .order('scheduled_time', { ascending: true })

            if (marketError) console.error('Market fetch error:', marketError)
            
            const marketWithRelations = await resolveRelations(marketData || [])

            // --- SUITABILITY ANALYSIS AND FILTERING ---
            const processedMarket = marketWithRelations
                .filter(job => myAvailableSlots.includes(`${job.scheduled_date}_${(job.scheduled_time || '').slice(0, 5)}`))
                .map(job => {
                    // Identify all other staff members who are on-duty for this specific slot
                    const slotDuty = (dutySchedules || []).filter(s => 
                        s.date === job.scheduled_date && 
                        (s.time_slot || '').slice(0, 5) === (job.scheduled_time || '').slice(0, 5) && 
                        !s.is_booked
                    )

                    if (slotDuty.length <= 1) return { ...job, suitability: 'recommended' }

                    // Distance benchmarking
                    let minDist = Infinity
                    let closestStaffId = ''

                    slotDuty.forEach(duty => {
                        const sInfo = allStaff?.find(st => st.id === duty.staff_id)
                        const bInfo = allBranches?.find(br => br.id === sInfo?.branch_id)
                        if (bInfo) {
                            const dist = haversine(job.pickup_lat, job.pickup_lng, bInfo.lat, bInfo.lng)
                            if (dist < minDist) {
                                minDist = dist
                                closestStaffId = duty.staff_id
                            }
                        }
                    })

                    return { 
                        ...job, 
                        suitability: (closestStaffId === staffId) ? 'recommended' : 'available' 
                    }
                })

            setAvailableJobs(processedMarket)

        } catch (e) {
            console.error('Loader error:', e)
        } finally {
            setLoading(false)
        }
    }, [staffId, today])

    // BUG-16 FIX: removed duplicate staffId setter (race condition with auth guard)

    useEffect(() => {
        load()
    }, [load])

    const handleAccept = async () => {
        if (!confirmingJob) return
        const { id: jobId } = confirmingJob
        
        setActionLoading(jobId)
        setConfirmingJob(null)
        
        try {
            if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
                // Handle locally for Mock DB
                const { error: updateError } = await supabase
                    .from('bookings')
                    .update({ 
                        staff_id: staffId, 
                        status: 'confirmed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', jobId)
                
                if (updateError) throw updateError

                // Mark schedule
                await supabase.from('staff_schedules')
                    .update({ is_booked: true })
                    .eq('staff_id', staffId)
                    .eq('zone_id', confirmingJob.zone_id)
                    .eq('date', confirmingJob.scheduled_date)
                    .eq('time_slot', confirmingJob.scheduled_time)

                // Optional: Trigger a client-side success alert or re-load
            } else {
                const res = await fetch(`/api/bookings/${jobId}/accept`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ staff_id: staffId })
                })
                
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'ไม่สามารถรับงานได้')
            }
            
            await load()
        } catch (e: any) {
            console.error('Accept error:', e)
            alert(e.message || 'เกิดข้อผิดพลาดบางอย่าง')
        } finally {
            setActionLoading(null)
        }
    }

    const todayJobs = jobs.filter(j => j.scheduled_date === today)
    const upcomingJobs = jobs.filter(j => j.scheduled_date > today)

    return (
        <>
            <div className="animate-fade">
                <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>หน้าหลัก</h1>
                    <p className={styles.date}>{new Date().toLocaleDateString('th-TH', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
                <div className={styles.statPill} style={{ background: 'var(--brand-subordinate-ghost)', color: 'var(--brand-dominant)', borderColor: 'var(--brand-subordinate)' }}>
                    <div className={styles.iconBox}>
                        <ShoppingBag size={20} />
                    </div>
                    <div className={styles.statN}>{availableJobs.length}</div>
                    <div className={styles.statL}>ตลาดงาน</div>
                </div>
                <div className={styles.statPill} style={{ background: 'var(--brand-accent-ghost)', color: 'var(--brand-accent-dark)', borderColor: 'var(--brand-accent)' }}>
                    <div className={styles.iconBox}>
                        <Calendar size={20} />
                    </div>
                    <div className={styles.statN}>{todayJobs.length}</div>
                    <div className={styles.statL}>งานวันนี้</div>
                </div>
                <div className={styles.statPill} style={{ background: 'var(--info-ghost)', color: 'var(--info)', borderColor: 'var(--info-light)' }}>
                    <div className={styles.iconBox}>
                        <Clock size={20} />
                    </div>
                    <div className={styles.statN}>{upcomingJobs.length}</div>
                    <div className={styles.statL}>งานที่จะถึง</div>
                </div>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
            ) : (
                <>
                    {availableJobs.length > 0 && (
                        <>
                            <h2 className={styles.sectionTitle} style={{ color: 'var(--brand-dominant)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ShoppingBag size={20} /> ตลาดงาน
                            </h2>
                            <div className={styles.marketList}>
                                {availableJobs.map(job => (
                                    <div 
                                        key={job.id} 
                                        className={`${styles.jobCard} ${job.suitability === 'recommended' ? styles.jobCardRecommended : styles.jobCardAvailable}`}
                                    >
                                        <div className={styles.jobTime}>
                                            <span>{job.scheduled_time?.slice(0, 5)}</span>
                                            <span className={styles.jobDate}>{job.scheduled_date}</span>
                                        </div>
                                        <div className={styles.jobBody}>
                                            <div className={styles.jobCustomer} style={{ fontSize: '1.2rem', marginBottom: 2 }}>{getPlaceName(job.pickup_address)}</div>
                                            <div className={styles.jobDetail}>
                                                {job.customers?.vehicle_brand} {job.customers?.vehicle_model} {job.customers?.vehicle_color && `(${job.customers.vehicle_color})`} · {job.services?.name} 
                                            </div>
                                            <div className={styles.jobDetail} style={{ fontSize: '0.75rem', color: job.suitability === 'recommended' ? 'var(--brand-dominant)' : 'var(--text-muted)', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                {job.suitability === 'recommended' ? <><Sparkles size={12} /> เหมาะสำหรับคุณ (อยู่ใกล้ที่สุด)</> : <><Info size={12} /> มีพนักงานคนอื่นที่เหมาะสมกว่า</>}
                                            </div>
                                        </div>
                                        <button 
                                            className="btn btn-primary btn-sm" 
                                            onClick={() => setConfirmingJob(job)}
                                            disabled={!!actionLoading}
                                            style={{ borderRadius: 'var(--radius-full)', background: job.suitability === 'recommended' ? 'var(--brand-dominant)' : 'var(--brand-subordinate)', color: job.suitability === 'recommended' ? 'white' : 'var(--brand-dominant)', border: 'none', minWidth: 80, fontWeight: 700 }}
                                        >
                                            {actionLoading === job.id ? <span className="spinner spinner-white" style={{ width: 14, height: 14 }} /> : 'รับงาน'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <h2 className={styles.sectionTitle} style={{ marginTop: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Calendar size={20} /> งานวันนี้
                    </h2>
                    {todayJobs.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                            <CheckCircle size={40} color="var(--brand-dominant)" style={{ opacity: 0.5, marginBottom: 16 }} />
                            <p className="empty-state-title">ไม่มีงานที่ต้องทำ</p>
                        </div>
                    ) : todayJobs.map(job => <JobCard key={job.id} job={job} />)}

                    {upcomingJobs.length > 0 && (
                        <>
                            <h2 className={styles.sectionTitle} style={{ marginTop: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Clock size={20} /> งานที่จะมาถึง
                            </h2>
                            {/* Group by date, sorted ascending (nearest first) */}
                            {Object.entries(
                                upcomingJobs.reduce((acc: any, job) => {
                                    const date = job.scheduled_date
                                    if (!acc[date]) acc[date] = []
                                    acc[date].push(job)
                                    return acc
                                }, {})
                            )
                            .sort((a, b) => a[0].localeCompare(b[0])) // Sort keys (dates) chronologically
                            .map(([date, dateJobs]: [string, any]) => (
                                <div key={date} style={{ marginBottom: 'var(--space-4)' }}>
                                    <div className={styles.dateHeader}>
                                        <Calendar size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                                        {new Date(date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </div>
                                    {dateJobs.map((job: any) => <JobCard key={job.id} job={job} />)}
                                </div>
                            ))}
                        </>
                    )}
                </>
            )}
        </div>

        {/* Custom Confirm Modal */}
        {confirmingJob && (
            <div className={styles.modalOverlay} onClick={() => setConfirmingJob(null)}>
                <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
                        <HelpCircle size={64} color="var(--brand-dominant)" />
                    </div>
                    <h3 className={styles.modalTitle}>รับงานนี้ใช่หรือไม่?</h3>
                    <p className={styles.modalDesc}>
                        เมื่อกดรับแล้ว คุณจะต้องรับผิดชอบงานนี้<br/>
                        {confirmingJob.scheduled_time?.slice(0, 5)} น. ({confirmingJob.scheduled_date})
                    </p>
                    <div className={styles.modalActions}>
                        <button className="btn btn-ghost btn-full" style={{ borderRadius: '16px' }} onClick={() => setConfirmingJob(null)}>ยกเลิก</button>
                        <button className="btn btn-primary btn-full" style={{ background: 'var(--brand-dominant)', border: 'none', borderRadius: '18px', gap: 8, height: 50, fontWeight: 700 }} onClick={handleAccept}>
                            <CheckCircle size={20} /> ยืนยันรับงาน
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
)
}

function JobCard({ job }: { job: any }) {
    return (
        <Link href={`/staff/jobs/${job.id}`} className={styles.jobCard}>
            <div className={styles.jobTime}>
                <span>{job.scheduled_time?.slice(0, 5)}</span>
                <span className={styles.jobDate}>{job.scheduled_date}</span>
            </div>
            <div className={styles.jobBody}>
                <div className={styles.jobCustomer} style={{ fontSize: '1.2rem', marginBottom: 2 }}>{getPlaceName(job.pickup_address)}</div>
                <div className={styles.jobDetail}>
                    {job.customers?.vehicle_brand} {job.customers?.vehicle_model} {job.customers?.vehicle_color && `(${job.customers.vehicle_color})`} {job.customers?.license_plate && `· ${job.customers.license_plate}`} · {job.services?.name}
                </div>
            </div>
            <span className={`badge ${BOOKING_STATUS_CSS[job.status as BookingStatus] || ''}`}>
                {BOOKING_STATUS_LABEL[job.status as BookingStatus] || job.status}
            </span>
        </Link>
    )
}
