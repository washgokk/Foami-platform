'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Star, MessageSquare, Filter, RefreshCw, User, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react'

interface ReviewItem {
  id: string
  rating: number
  comment: string
  created_at: string
  customer_name: string
  vehicle_data?: any
  booking_id: string
}

export default function ShopReviewsPage() {
  const params = useParams()
  const branchSlug = (params?.branchSlug as string) || 'kku'

  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRating, setFilterRating] = useState<number | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Get branch
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('slug', branchSlug)
        .maybeSingle()

      const branchId = branch?.id

      // 2. Fetch bookings with rating > 0 for this branch
      let query = supabase
        .from('bookings')
        .select('id, rating, review_comment, updated_at, created_at, vehicle_data, customer_id')
        .gt('rating', 0)
        .order('created_at', { ascending: false })

      if (branchId) query = query.eq('branch_id', branchId)

      const { data: bookingsData } = await query

      // 3. Fetch customer names
      const { data: customerData } = await supabase.from('customers').select('id, full_name')
      const customerMap = new Map((customerData || []).map(c => [c.id, c.full_name]))

      const mapped: ReviewItem[] = (bookingsData || []).map(b => ({
        id: b.id,
        rating: b.rating || 5,
        comment: b.review_comment || 'ไม่มีข้อความรีวิว',
        created_at: b.updated_at || b.created_at,
        customer_name: customerMap.get(b.customer_id) || 'ลูกค้าทั่วไป',
        vehicle_data: b.vehicle_data,
        booking_id: b.id,
      }))

      setReviews(mapped)
    } finally {
      setLoading(false)
    }
  }, [branchSlug])

  useEffect(() => { load() }, [load])

  // Rating metrics
  const totalReviews = reviews.length
  const avgRating = totalReviews > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / totalReviews) : 0
  const ratingCounts = {
    5: reviews.filter(r => r.rating === 5).length,
    4: reviews.filter(r => r.rating === 4).length,
    3: reviews.filter(r => r.rating === 3).length,
    2: reviews.filter(r => r.rating === 2).length,
    1: reviews.filter(r => r.rating === 1).length,
  }

  const filtered = filterRating === 'all'
    ? reviews
    : reviews.filter(r => r.rating === filterRating)

  const fmt = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Star size={24} color="#F59E0B" fill="#F59E0B" /> ภาพรวมรีวิวจากลูกค้า ({branchSlug})
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            คะแนนความพึงพอใจและข้อติชมจากลูกค้าหลังรับบริการ
          </div>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px',
          borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)',
          cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif',
          color: 'var(--text-secondary)'
        }}>
          <RefreshCw size={13} /> รีเฟรช
        </button>
      </div>

      {/* Summary Score Card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 22, padding: '24px 28px', boxShadow: 'var(--shadow-card)',
        display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, marginBottom: 24,
        alignItems: 'center'
      }}>
        {/* Big Score Box */}
        <div style={{ textAlign: 'center', borderRight: '1px solid var(--border)', paddingRight: 28 }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#1A2340', lineHeight: 1 }}>
            {avgRating > 0 ? avgRating.toFixed(1) : '—'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, margin: '8px 0' }}>
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                size={18}
                fill={star <= Math.round(avgRating) ? '#F59E0B' : '#E8EEF8'}
                color={star <= Math.round(avgRating) ? '#F59E0B' : '#E8EEF8'}
              />
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {totalReviews} รีวิวทั้งหมด
          </div>
        </div>

        {/* Star Progress Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[5, 4, 3, 2, 1].map(stars => {
            const count = ratingCounts[stars as keyof typeof ratingCounts]
            const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0
            return (
              <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                <span style={{ width: 45, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {stars} <Star size={12} fill="#F59E0B" color="#F59E0B" />
                </span>
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: '#F59E0B', borderRadius: 99, transition: 'all .3s' }} />
                </div>
                <span style={{ width: 35, textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {(['all', 5, 4, 3, 2, 1] as const).map(f => (
          <button
            key={String(f)}
            onClick={() => setFilterRating(f)}
            style={{
              padding: '7px 16px', borderRadius: 12, border: '1.5px solid',
              borderColor: filterRating === f ? 'var(--brand)' : 'var(--border)',
              background: filterRating === f ? 'var(--brand-ghost)' : 'var(--surface)',
              color: filterRating === f ? 'var(--brand)' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif'
            }}
          >
            {f === 'all' ? `ทั้งหมด (${totalReviews})` : `${f} ดาว (${ratingCounts[f as keyof typeof ratingCounts]})`}
          </button>
        ))}
      </div>

      {/* Reviews List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
            กำลังโหลดรีวิว...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: 48, textAlign: 'center', color: 'var(--text-muted)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20
          }}>
            <MessageSquare size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: .3 }} />
            ยังไม่มีรีวิวในหมวดนี้
          </div>
        ) : (
          filtered.map(r => (
            <div key={r.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 18, padding: '18px 22px', boxShadow: 'var(--shadow-card)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12, background: 'var(--brand-ghost)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)',
                    fontWeight: 700, fontSize: 14
                  }}>
                    <User size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {r.customer_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      BK-{r.booking_id.substring(0, 8)} · {fmt(r.created_at)}
                    </div>
                  </div>
                </div>

                {/* Stars */}
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      size={14}
                      fill={s <= r.rating ? '#F59E0B' : '#E8EEF8'}
                      color={s <= r.rating ? '#F59E0B' : '#E8EEF8'}
                    />
                  ))}
                </div>
              </div>

              {/* Comment text */}
              <div style={{
                fontSize: 13, color: '#334155', lineHeight: 1.6,
                background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 12,
                marginTop: 8
              }}>
                "{r.comment}"
              </div>

              {/* Vehicle info badge if present */}
              {r.vehicle_data && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 6 }}>
                  <span>🚗 {r.vehicle_data.brand || ''} {r.vehicle_data.model || ''} ({r.vehicle_data.plate || 'ไม่ระบุทะเบียน'})</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
