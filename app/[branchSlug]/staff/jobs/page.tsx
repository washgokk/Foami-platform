'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Briefcase, MapPin, Phone, Calendar, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function StaffBranchJobsPage() {
  const { branchSlug } = useParams() as { branchSlug: string }
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('branches')
      .select('id')
      .eq('slug', branchSlug)
      .maybeSingle()
      .then(({ data: b }) => {
        if (b) {
          supabase
            .from('bookings')
            .select('*')
            .eq('branch_id', b.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              setJobs(data || [])
              setLoading(false)
            })
        }
      })
  }, [branchSlug])

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1E293B', marginBottom: 18 }}>
        รายการงานทั้งหมด
      </h1>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>กำลังโหลด...</div>
      ) : jobs.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', background: '#FFFFFF', borderRadius: 16 }}>
          ยังไม่มีรายการงานในสาขานี้
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {jobs.map(job => (
            <div key={job.id} style={{
              background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 14,
              padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>{job.customer_name || 'ลูกค้า'}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, display: 'flex', gap: 12 }}>
                  <span>{job.date} · {job.time_slot}</span>
                  {job.phone && <span>{job.phone}</span>}
                </div>
                {job.address && (
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                    {job.address}
                  </div>
                )}
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
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
  )
}
