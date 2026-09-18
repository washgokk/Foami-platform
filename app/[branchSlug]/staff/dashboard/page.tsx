'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, Calendar, CheckCircle2, Clock, MapPin, ChevronRight, Store } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function StaffBranchDashboard() {
  const { branchSlug } = useParams() as { branchSlug: string }
  const [branch, setBranch] = useState<any>(null)
  const [staff, setStaff] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const s = JSON.parse(localStorage.getItem('staff_data') || '{}')
    setStaff(s)

    supabase
      .from('branches')
      .select('*')
      .eq('slug', branchSlug)
      .maybeSingle()
      .then(({ data: b }) => {
        if (b) {
          setBranch(b)
          if (s.id) {
            supabase
              .from('bookings')
              .select('*')
              .eq('branch_id', b.id)
              .order('date', { ascending: false })
              .limit(10)
              .then(({ data }) => {
                setJobs(data || [])
                setLoading(false)
              })
          }
        }
      })
  }, [branchSlug])

  const brandColor = branch?.primary_color || '#315EC3'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${brandColor}, #1E3A8A)`,
        borderRadius: 20, padding: '24px 28px', color: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>สาขา {branch?.name}</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: '4px 0 8px' }}>
            สวัสดีคุณ {staff?.full_name || 'ช่างประจำสาขา'}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
            พร้อมรับงานบริการล้างรถและคิวงานประจำวัน
          </p>
        </div>

        <Link
          href={`/${branchSlug}/staff/schedule`}
          style={{
            padding: '10px 18px', borderRadius: 12, background: '#FFFFFF',
            color: brandColor, textDecoration: 'none', fontWeight: 700, fontSize: 13
          }}
        >
          ตั้งตารางงาน →
        </Link>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #E2E8F0', padding: 18 }}>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>งานที่รอดำเนินการ</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: brandColor, marginTop: 4 }}>
            {jobs.filter(j => j.status === 'confirmed').length}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #E2E8F0', padding: 18 }}>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>งานเสร็จสิ้นสัปดาห์นี้</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#16A34A', marginTop: 4 }}>
            {jobs.filter(j => j.status === 'completed').length}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #E2E8F0', padding: 18 }}>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>งานทั้งหมดในสาขา</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#1E293B', marginTop: 4 }}>
            {jobs.length}
          </div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 18, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: 0 }}>คิวงานล่าสุด</h2>
          <Link href={`/${branchSlug}/staff/jobs`} style={{ fontSize: 12, color: brandColor, textDecoration: 'none', fontWeight: 700 }}>
            ดูทั้งหมด →
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 13 }}>
            ยังไม่มีงานในระบบ
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jobs.slice(0, 5).map(job => (
              <div key={job.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #EEF2F6'
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{job.customer_name || 'ลูกค้า'}</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{job.date} · {job.time_slot}</div>
                </div>
                <span style={{
                  padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: job.status === 'completed' ? '#DCFCE7' : '#EFF6FF',
                  color: job.status === 'completed' ? '#15803D' : '#1D4ED8'
                }}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
