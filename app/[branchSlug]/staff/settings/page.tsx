'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { User, Mail, Phone, Lock, Save } from 'lucide-react'

export default function StaffBranchSettingsPage() {
  const { branchSlug } = useParams() as { branchSlug: string }
  const [staff, setStaff] = useState<any>(null)

  useEffect(() => {
    const s = JSON.parse(localStorage.getItem('staff_data') || '{}')
    setStaff(s)
  }, [])

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1E293B', marginBottom: 18 }}>
        ข้อมูลพนักงาน
      </h1>

      <div style={{
        background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 16,
        padding: 24, display: 'flex', flexDirection: 'column', gap: 14
      }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>ชื่อ-นามสกุล</label>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{staff?.full_name || '—'}</div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>อีเมล</label>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{staff?.email || '—'}</div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>เบอร์โทรศัพท์</label>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{staff?.phone || '—'}</div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>ตำแหน่ง / สิทธิ์</label>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#315EC3' }}>{staff?.role?.toUpperCase() || 'STAFF'}</div>
        </div>
      </div>
    </div>
  )
}
