'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Settings, Palette, Globe, Image as ImageIcon,
  Save, CheckCircle2, AlertCircle, RefreshCw, Store, Phone, MapPin,
  Plus, Edit3, Trash2, AlertTriangle, RotateCcw, Check, Layers, Navigation
} from 'lucide-react'
import dynamic from 'next/dynamic'
import ImageUpload from '@/components/ImageUpload'
import { calculatePolygonAreaKm2 } from '@/lib/geo-utils'

const ZoneMapEditor = dynamic(() => import('@/app/admin/branches/[id]/zones/ZoneMapEditor'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 420, background: 'var(--surface-2, #F8FAFC)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
      กำลังโหลดแผนที่...
    </div>
  )
})

const ZONE_COLORS = ['#315EC3', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0891B2', '#059669']

function SettingsContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const branchSlug = (params?.branchSlug as string) || 'kku'
  const initialTab = searchParams.get('tab') === 'zones' ? 'zones' : 'profile'

  const [activeTab, setActiveTab] = useState<'profile' | 'zones'>(initialTab)

  // Profile state
  const [form, setForm] = useState({
    name: '',
    browser_title: '',
    logo_url: '',
    cover_photo_url: '',
    shop_photos: [] as string[],
    shop_description: '',
    primary_color: '#315EC3',
    accent_color: '#A0D9F6',
    phone: '',
    address: '',
  })
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Zones state
  const [branch, setBranch] = useState<any>(null)
  const [zones, setZones] = useState<any[]>([])
  const [loadingZones, setLoadingZones] = useState(true)
  const [createMode, setCreateMode] = useState<'idle' | 'naming' | 'drawing'>('idle')
  const [editingZone, setEditingZone] = useState<any>(null)
  const [zoneForm, setZoneForm] = useState({ name: '', description: '', color: '#315EC3' })
  const [savingZone, setSavingZone] = useState(false)
  const [zoneNotice, setZoneNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [editingInfoZone, setEditingInfoZone] = useState<any>(null) // for edit name/color modal

  // Load Profile & Branch data
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [{ data: branchData }, { data: appSetting }] = await Promise.all([
          supabase.from('branches').select('*').eq('slug', branchSlug).maybeSingle(),
          supabase.from('app_settings').select('value').eq('key', `shop_settings:${branchSlug}`).maybeSingle()
        ])

        setBranch(branchData)

        const s = appSetting?.value || {}
        const name = branchData?.name || s.name || branchSlug
        const loadedTitle = s.browser_title || branchData?.browser_title || name || `Foami — สาขา ${name}`

        setForm({
          name,
          browser_title: loadedTitle,
          logo_url: s.logo_url ?? branchData?.logo_url ?? '',
          cover_photo_url: s.cover_photo_url ?? branchData?.cover_photo_url ?? '',
          shop_photos: s.shop_photos ?? branchData?.shop_photos ?? [],
          shop_description: s.shop_description ?? branchData?.shop_description ?? '',
          primary_color: s.primary_color ?? branchData?.primary_color ?? '#315EC3',
          accent_color: s.accent_color ?? branchData?.accent_color ?? '#A0D9F6',
          phone: s.phone ?? branchData?.phone ?? '',
          address: branchData?.address ?? s.address ?? '',
        })

        if (loadedTitle) document.title = loadedTitle

        if (branchData) {
          const { data: z } = await supabase.from('zones').select('*').eq('branch_id', branchData.id).order('name')
          setZones(z || [])
        }
      } finally {
        setLoading(false)
        setLoadingZones(false)
      }
    }
    loadData()
  }, [branchSlug])

  const loadZones = useCallback(async () => {
    if (!branch?.id) return
    setLoadingZones(true)
    const { data: z } = await supabase.from('zones').select('*').eq('branch_id', branch.id).order('name')
    setZones(z || [])
    setLoadingZones(false)
  }, [branch?.id])

  const switchTab = (tab: 'profile' | 'zones') => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', tab)
      window.history.replaceState(null, '', url.toString())
    }
  }

  // Save profile settings
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileError('')
    setProfileSuccess(false)

    try {
      const settingsPayload = {
        name: form.name,
        browser_title: form.browser_title,
        logo_url: form.logo_url,
        cover_photo_url: form.cover_photo_url,
        shop_photos: form.shop_photos,
        shop_description: form.shop_description,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        phone: form.phone,
        address: form.address,
        updated_at: new Date().toISOString()
      }

      await supabase.from('app_settings').upsert({
        key: `shop_settings:${branchSlug}`,
        value: settingsPayload
      })

      await supabase.from('branches').update({
        name: form.name,
        address: form.address,
        logo_url: form.logo_url,
        cover_photo_url: form.cover_photo_url,
        shop_photos: form.shop_photos,
        shop_description: form.shop_description
      }).eq('slug', branchSlug)

      if (form.browser_title) document.title = form.browser_title
      window.dispatchEvent(new CustomEvent('foami:shop-settings-updated', { detail: settingsPayload }))

      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err: any) {
      setProfileError(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSavingProfile(false)
    }
  }

  // Zone Handlers
  const handleStartCreateZone = () => {
    setEditingZone(null)
    setZoneForm({
      name: '',
      description: '',
      color: ZONE_COLORS[zones.length % ZONE_COLORS.length]
    })
    setCreateMode('naming')
    setZoneNotice(null)
  }

  const handleProceedToDrawing = () => {
    if (!zoneForm.name.trim()) {
      setZoneNotice({ type: 'error', message: 'กรุณากรอกชื่อโซนบริการ' })
      return
    }
    setCreateMode('drawing')
    setZoneNotice(null)
  }

  const handleSaveNewZone = async (polygon_coords: [number, number][]) => {
    if (!branch?.id || !zoneForm.name.trim()) return
    setSavingZone(true)
    setZoneNotice(null)

    try {
      const { error } = await supabase.from('zones').insert({
        branch_id: branch.id,
        name: zoneForm.name.trim(),
        description: zoneForm.description.trim(),
        extra_fee: 0,
        color: zoneForm.color,
        polygon_coords,
        is_active: true
      })

      if (error) throw error

      setZoneNotice({ type: 'success', message: `สร้างโซน "${zoneForm.name}" สำเร็จ (รับ-ส่งฟรี ฿0)` })
      setCreateMode('idle')
      setEditingZone(null)
      loadZones()
    } catch (err: any) {
      setZoneNotice({ type: 'error', message: err.message || 'เกิดข้อผิดพลาดในการบันทึกโซน' })
    } finally {
      setSavingZone(false)
    }
  }

  const handleStartRedraw = (z: any) => {
    setEditingZone(z)
    setZoneForm({ name: z.name, description: z.description || '', color: z.color || '#315EC3' })
    setCreateMode('drawing')
    setZoneNotice(null)
  }

  const handleSaveRedraw = async (polygon_coords: [number, number][]) => {
    if (!editingZone?.id) return
    setSavingZone(true)
    setZoneNotice(null)

    try {
      const { error } = await supabase.from('zones').update({
        polygon_coords,
        extra_fee: 0
      }).eq('id', editingZone.id)

      if (error) throw error

      setZoneNotice({ type: 'success', message: `อัปเดตขอบเขตโซน "${editingZone.name}" เรียบร้อยแล้ว` })
      setCreateMode('idle')
      setEditingZone(null)
      loadZones()
    } catch (err: any) {
      setZoneNotice({ type: 'error', message: err.message || 'เกิดข้อผิดพลาดในการแก้ไขขอบเขต' })
    } finally {
      setSavingZone(false)
    }
  }

  const handleToggleZone = async (zone: any) => {
    const nextState = !zone.is_active
    await supabase.from('zones').update({ is_active: nextState }).eq('id', zone.id)
    loadZones()
  }

  const handleDeleteZone = async (zone: any) => {
    if (!confirm(`ต้องการลบโซน "${zone.name}" หรือไม่?\n(ประวัติการจองในอดีตจะยังคงอยู่)`)) return
    await supabase.from('zones').delete().eq('id', zone.id)
    setZoneNotice({ type: 'success', message: `ลบโซน "${zone.name}" แล้ว` })
    loadZones()
  }

  const handleSaveEditInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingInfoZone) return
    await supabase.from('zones').update({
      name: editingInfoZone.name,
      description: editingInfoZone.description,
      color: editingInfoZone.color
    }).eq('id', editingInfoZone.id)
    setEditingInfoZone(null)
    loadZones()
  }

  const mapCenter: [number, number] = branch?.lat && branch?.lng ? [branch.lat, branch.lng] : [16.44, 102.83]

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={26} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
        กำลังโหลดการตั้งค่าร้านและโซนบริการ...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={24} color="var(--brand-dominant, #315EC3)" /> ตั้งค่าร้านค้า & โซนบริการ ({branchSlug})
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          จัดการข้อมูลแบรนด์ ภาพลักษณ์ และกำหนดขอบเขตพื้นที่ให้บริการของสาขาในที่เดียว
        </div>
      </div>

      {/* Unified Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '2px solid var(--border)',
        marginBottom: 24,
        paddingBottom: 2
      }}>
        <button
          type="button"
          onClick={() => switchTab('profile')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 20px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            border: 'none',
            background: 'none',
            color: activeTab === 'profile' ? 'var(--brand-dominant, #315EC3)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'profile' ? '3px solid var(--brand-dominant, #315EC3)' : '3px solid transparent',
            marginBottom: -4,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Store size={18} />
          ข้อมูลร้าน & ธีมแบรนด์
        </button>

        <button
          type="button"
          onClick={() => switchTab('zones')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 20px',
            fontSize: '0.92rem',
            fontWeight: activeTab === 'zones' ? 700 : 500,
            border: 'none',
            background: 'none',
            color: activeTab === 'zones' ? 'var(--brand-dominant, #315EC3)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'zones' ? '3px solid var(--brand-dominant, #315EC3)' : '3px solid transparent',
            marginBottom: -4,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <MapPin size={18} />
          พื้นที่บริการ & โซน (100 ตร.กม.)
          {zones.length > 0 && (
            <span style={{
              background: activeTab === 'zones' ? 'var(--brand-dominant, #315EC3)' : 'var(--surface-2, #E2E8F0)',
              color: activeTab === 'zones' ? '#ffffff' : 'var(--text-muted)',
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {zones.length}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: SHOP PROFILE & BRANDING                           */}
      {/* ========================================================= */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Section 1: Display Name & Tab Title */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '24px 26px', boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={16} color="var(--brand-dominant, #315EC3)" /> ชื่อและข้อความแสดงผล (Browser Tab)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  ชื่อสาขา / ชื่อร้าน
                </label>
                <div style={{ position: 'relative' }}>
                  <Store size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    style={{
                      width: '100%', padding: '11px 14px 11px 40px', borderRadius: 14,
                      border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'Kanit, sans-serif',
                      outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  ชื่อที่จะแสดงบนแท็บเบราว์เซอร์ (Browser Tab Title)
                </label>
                <input
                  type="text"
                  placeholder="เช่น Foami — สาขา มข. (KKU)"
                  value={form.browser_title}
                  onChange={e => {
                    const val = e.target.value
                    setForm(f => ({ ...f, browser_title: val }))
                    if (val) document.title = val
                  }}
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 14,
                    border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'Kanit, sans-serif',
                    outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box'
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  จะถูกนำไปแสดงเป็น &lt;title&gt; ประจำสาขานี้บนแท็บเบราว์เซอร์ทันที
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  คำอธิบายร้านค้า (Shop Description)
                </label>
                <textarea
                  rows={3}
                  placeholder="เช่น บริการล้างรถและเดลิเวอรี่ระดับพรีเมียม รับ-ส่งรถถึงที่ ขัดเคลือบสีด้วยน้ำยามาตรฐานญี่ปุ่น"
                  value={form.shop_description}
                  onChange={e => setForm(f => ({ ...f, shop_description: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 14,
                    border: '1.5px solid var(--border)', fontSize: 13.5, fontFamily: 'Kanit, sans-serif',
                    outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box',
                    resize: 'vertical', lineHeight: 1.5
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  ข้อความนี้จะแสดงในหน้าต่างรายละเอียดร้านค้าบนหน้าค้นหา Marketplace ให้ลูกค้าอ่าน
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Logo & Media */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '24px 26px', boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ImageIcon size={16} color="var(--brand-dominant, #315EC3)" /> รูปภาพและแบรนด์
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>โลโก้ร้านค้า</div>
                <ImageUpload
                  value={form.logo_url}
                  onChange={url => setForm(f => ({ ...f, logo_url: url }))}
                  bucket="shop-assets"
                  folder="logos"
                  label="อัปโหลดโลโก้ร้าน"
                />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>รูปหน้าปกร้าน (Cover Photo)</div>
                <ImageUpload
                  value={form.cover_photo_url}
                  onChange={url => setForm(f => ({ ...f, cover_photo_url: url }))}
                  bucket="shop-assets"
                  folder="covers"
                  label="อัปโหลดรูปหน้าปกร้าน"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Theme Colors */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '24px 26px', boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Palette size={16} color="var(--brand-dominant, #315EC3)" /> ธีมสีประจำสาขา
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  สีหลัก (Primary Color)
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                    style={{ width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={form.primary_color}
                    onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 12,
                      border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'monospace', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  สีรอง / ไฮไลท์ (Accent Color)
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={form.accent_color}
                    onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))}
                    style={{ width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={form.accent_color}
                    onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 12,
                      border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'monospace', outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Address & Phone */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '24px 26px', boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} color="var(--brand-dominant, #315EC3)" /> เบอร์โทรและที่อยู่สาขา
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  เบอร์โทรติดต่อ
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="08X-XXX-XXXX"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    style={{
                      width: '100%', padding: '11px 14px 11px 40px', borderRadius: 14,
                      border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'Kanit, sans-serif',
                      outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  ที่อยู่ตั้งสาขา
                </label>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 14,
                    border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'Kanit, sans-serif',
                    outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {profileError && (
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderRadius: 12, background: '#FEE2E2', color: '#B91C1C', fontSize: 13 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} /> {profileError}
            </div>
          )}

          {profileSuccess && (
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderRadius: 12, background: '#DCFCE7', color: '#15803D', fontSize: 13, fontWeight: 600 }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> บันทึกข้อมูลตั้งค่าร้านเรียบร้อยแล้ว
            </div>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 24px', borderRadius: 16, background: 'var(--brand-dominant, #315EC3)', color: '#fff',
              border: 'none', cursor: savingProfile ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700,
              fontFamily: 'Kanit, sans-serif', boxShadow: 'var(--shadow-brand)', opacity: savingProfile ? 0.7 : 1
            }}
          >
            <Save size={18} /> {savingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูลร้านค้า'}
          </button>
        </form>
      )}

      {/* ========================================================= */}
      {/* TAB 2: SERVICE AREA & ZONES (100 KM2 LIMIT)              */}
      {/* ========================================================= */}
      {activeTab === 'zones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Policy Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(49, 94, 195, 0.05), rgba(16, 185, 129, 0.05))',
            border: '1px solid rgba(49, 94, 195, 0.2)',
            borderRadius: 18, padding: '18px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803D', fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>
              <CheckCircle2 size={18} />
              อยู่ในพื้นที่บริการ: รับ-ส่งฟรี ฿0 ทุกโซนในสาขา
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              • ลูกค้าที่อยู่ในขอบเขตโซนบริการของร้านจะได้รับสิทธิ์ <strong>รับ-ส่งฟรี ฿0</strong> โดยไม่มีการคิดค่าบริการข้ามโซน<br />
              • ลูกค้าอยู่นอกโซน: ระบบคิดค่านอกโซนตามระยะถนนจริง (OSRM) จากขอบเขตที่ใกล้ที่สุด (แบ่งสัดส่วน: <strong>60% พนักงาน, 30% ร้านค้า, 10% แอดมิน</strong>)<br />
              • จำกัดขนาดพื้นที่บริการรวมสูงสุด <strong>100 ตารางกิโลเมตร</strong> ต่อสาขา
            </div>
          </div>

          {zoneNotice && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', borderRadius: 12,
              background: zoneNotice.type === 'success' ? '#DCFCE7' : '#FEE2E2',
              color: zoneNotice.type === 'success' ? '#15803D' : '#B91C1C',
              fontSize: 13, fontWeight: 600
            }}>
              {zoneNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {zoneNotice.message}
            </div>
          )}

          {/* Draw Mode Card */}
          {createMode === 'naming' && (
            <div style={{
              background: 'var(--surface)', border: '1.5px solid var(--brand-dominant, #315EC3)',
              borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-md)'
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                กำหนดชื่อและสีประจำโซนบริการ
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    ชื่อโซนบริการ *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น โซน มข. รอบมหาวิทยาลัยขอนแก่น"
                    value={zoneForm.name}
                    onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 12,
                      border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    คำอธิบายเพิ่มเติม
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ครอบคลุมโซนกังสดาล โคลัมโบ และหลังมอ"
                    value={zoneForm.description}
                    onChange={e => setZoneForm(f => ({ ...f, description: e.target.value }))}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 12,
                      border: '1.5px solid var(--border)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    สีระบุโซนบนแผนที่
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {ZONE_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setZoneForm(f => ({ ...f, color: c }))}
                        style={{
                          width: 32, height: 32, borderRadius: '50%', background: c,
                          border: zoneForm.color === c ? '3px solid #1E293B' : '2px solid transparent',
                          cursor: 'pointer', outline: 'none', transform: zoneForm.color === c ? 'scale(1.15)' : 'scale(1)',
                          transition: 'all 0.15s ease'
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={handleProceedToDrawing}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 20px', borderRadius: 12, background: 'var(--brand-dominant, #315EC3)',
                      color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, cursor: 'pointer'
                    }}
                  >
                    ขั้นตอนถัดไป: วาดขอบเขตบนแผนที่ →
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('idle')}
                    style={{
                      padding: '10px 18px', borderRadius: 12, background: 'var(--surface-2, #E2E8F0)',
                      color: 'var(--text-primary)', border: 'none', fontWeight: 600, fontSize: 13.5, cursor: 'pointer'
                    }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Drawing Canvas */}
          {createMode === 'drawing' && (
            <div style={{
              background: 'var(--surface)', border: '1.5px solid var(--brand-dominant, #315EC3)',
              borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-md)'
            }}>
              <div style={{ padding: '16px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {editingZone ? `วาดขอบเขตใหม่: ${editingZone.name}` : `วาดขอบเขตโซน: ${zoneForm.name}`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    คลิกซ้ายบนแผนที่เพื่อสร้างจุดขอบเขต (คลิกขวาเพื่อยกเลิกจุดล่าสุด)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setCreateMode('idle'); setEditingZone(null); }}
                  style={{
                    padding: '6px 14px', borderRadius: 8, background: 'transparent',
                    border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  ปิดโหมดวาด
                </button>
              </div>

              <ZoneMapEditor
                zones={zones}
                mode="draw"
                editingZone={editingZone || undefined}
                center={mapCenter}
                onSave={(coords) => {
                  if (editingZone) {
                    handleSaveRedraw(coords)
                  } else {
                    handleSaveNewZone(coords)
                  }
                }}
                onCancel={() => {
                  setCreateMode('idle')
                  setEditingZone(null)
                }}
              />
            </div>
          )}

          {/* Zone List & Map Overview */}
          {createMode === 'idle' && (
            <>
              {/* Actions Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                    รายการโซนบริการ ({zones.length} โซน)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    พนักงานในสาขารับงานได้ทุกโซนโดยไม่มีค่าใช้จ่ายข้ามโซน
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartCreateZone}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 12, background: 'var(--brand-dominant, #315EC3)',
                    color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(49, 94, 195, 0.25)'
                  }}
                >
                  <Plus size={16} /> เพิ่มโซนบริการ
                </button>
              </div>

              {/* Zone Cards */}
              {loadingZones ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>กำลังโหลดโซนบริการ...</div>
              ) : zones.length === 0 ? (
                <div style={{
                  padding: 48, textAlign: 'center', background: 'var(--surface)',
                  border: '1.5px dashed var(--border)', borderRadius: 20
                }}>
                  <MapPin size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>ยังไม่มีโซนบริการ</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 16 }}>
                    เริ่มต้นสร้างโซนบริการแรก เพื่อให้ลูกค้ารับรู้ขอบเขตการรับ-ส่งฟรีของร้าน
                  </div>
                  <button
                    type="button"
                    onClick={handleStartCreateZone}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px', borderRadius: 10, background: 'var(--brand-dominant, #315EC3)',
                      color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer'
                    }}
                  >
                    <Plus size={15} /> สร้างโซนแรก
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {zones.map(z => {
                    const area = calculatePolygonAreaKm2(z.polygon_coords || [])
                    return (
                      <div
                        key={z.id}
                        style={{
                          background: 'var(--surface)',
                          border: `1.5px solid ${z.is_active ? 'var(--border)' : '#FEE2E2'}`,
                          borderRadius: 16, padding: '16px 20px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          flexWrap: 'wrap', gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: z.color || '#315EC3', flexShrink: 0 }} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{z.name}</span>
                              <span style={{
                                fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                                background: z.is_active ? '#DCFCE7' : '#FEE2E2',
                                color: z.is_active ? '#15803D' : '#B91C1C'
                              }}>
                                {z.is_active ? 'เปิดให้บริการ' : 'หยุดชั่วคราว'}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                              {z.description && `${z.description} · `}
                              พื้นที่ ~{area.toFixed(2)} ตร.กม. · {z.polygon_coords?.length || 0} จุดบนแผนที่
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleStartRedraw(z)}
                            title="วาดขอบเขตใหม่บนแผนที่"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)',
                              background: 'var(--surface-2, #F8FAFC)', cursor: 'pointer', fontSize: 12, fontWeight: 600
                            }}
                          >
                            <RotateCcw size={13} /> วาดใหม่
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingInfoZone({ ...z })}
                            title="แก้ไขชื่อและสี"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)',
                              background: 'var(--surface-2, #F8FAFC)', cursor: 'pointer', fontSize: 12, fontWeight: 600
                            }}
                          >
                            <Edit3 size={13} /> แก้ไข
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleZone(z)}
                            style={{
                              padding: '6px 12px', borderRadius: 10, border: '1px solid',
                              borderColor: z.is_active ? '#FCA5A5' : '#86EFAC',
                              background: z.is_active ? '#FEF2F2' : '#F0FDF4',
                              color: z.is_active ? '#DC2626' : '#16A34A',
                              cursor: 'pointer', fontSize: 12, fontWeight: 700
                            }}
                          >
                            {z.is_active ? 'หยุด' : 'เปิด'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteZone(z)}
                            title="ลบโซนนี้"
                            style={{
                              padding: '6px 10px', borderRadius: 10, border: '1px solid #FCA5A5',
                              background: '#FEF2F2', color: '#DC2626', cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Integrated Overview Map */}
              {zones.length > 0 && (
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 20, overflow: 'hidden', marginTop: 10, boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ padding: '14px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={16} color="var(--brand-dominant, #315EC3)" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      แผนที่ขอบเขตบริการรวมทุกโซน
                    </span>
                  </div>
                  <ZoneMapEditor
                    zones={zones}
                    mode="view"
                    center={mapCenter}
                    onSave={() => {}}
                    onCancel={() => {}}
                  />
                </div>
              )}
            </>
          )}

          {/* Edit Info Modal */}
          {editingInfoZone && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
              }}
              onClick={() => setEditingInfoZone(null)}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  background: 'var(--surface, #fff)', borderRadius: 20, padding: 24,
                  width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-xl)'
                }}
              >
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>แก้ไขข้อมูลโซน</h3>
                <form onSubmit={handleSaveEditInfo} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>ชื่อโซน *</label>
                    <input
                      type="text"
                      required
                      value={editingInfoZone.name}
                      onChange={e => setEditingInfoZone({ ...editingInfoZone, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>คำอธิบาย</label>
                    <input
                      type="text"
                      value={editingInfoZone.description || ''}
                      onChange={e => setEditingInfoZone({ ...editingInfoZone, description: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>สีระบุโซน</label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {ZONE_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditingInfoZone({ ...editingInfoZone, color: c })}
                          style={{
                            width: 32, height: 32, borderRadius: '50%', background: c,
                            border: editingInfoZone.color === c ? '3px solid #1E293B' : '2px solid transparent',
                            cursor: 'pointer', outline: 'none', transform: editingInfoZone.color === c ? 'scale(1.15)' : 'scale(1)'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button
                      type="submit"
                      style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'var(--brand-dominant, #315EC3)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                    >
                      บันทึก
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingInfoZone(null)}
                      style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'var(--surface-2, #E2E8F0)', color: 'var(--text-primary)', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ShopSettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>กำลังโหลด...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
