'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Settings, Palette, Globe, Image as ImageIcon,
  Save, CheckCircle2, AlertCircle, RefreshCw, Store, Phone, MapPin
} from 'lucide-react'

import ImageUpload from '@/components/ImageUpload'

export default function ShopSettingsPage() {
  const params = useParams()
  const branchSlug = (params?.branchSlug as string) || 'kku'

  const [form, setForm] = useState({
    name: '',
    browser_title: '',
    logo_url: '',
    primary_color: '#315EC3',
    accent_color: '#A0D9F6',
    phone: '',
    address: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [{ data: branch }, { data: appSetting }] = await Promise.all([
          supabase.from('branches').select('*').eq('slug', branchSlug).maybeSingle(),
          supabase.from('app_settings').select('value').eq('key', `shop_settings:${branchSlug}`).maybeSingle()
        ])

        const s = appSetting?.value || {}
        const name = branch?.name || s.name || branchSlug
        const loadedTitle = s.browser_title || branch?.browser_title || name || `Foami — สาขา ${name}`

        setForm({
          name: name,
          browser_title: loadedTitle,
          logo_url: s.logo_url ?? branch?.logo_url ?? '',
          primary_color: s.primary_color ?? branch?.primary_color ?? '#315EC3',
          accent_color: s.accent_color ?? branch?.accent_color ?? '#A0D9F6',
          phone: s.phone ?? branch?.phone ?? '',
          address: branch?.address ?? s.address ?? '',
        })

        if (loadedTitle) document.title = loadedTitle
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [branchSlug])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSavedSuccess(false)

    try {
      // 1. Save to app_settings (guaranteed table in Supabase)
      const settingsPayload = {
        name: form.name,
        browser_title: form.browser_title,
        logo_url: form.logo_url,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        phone: form.phone,
        address: form.address,
        updated_at: new Date().toISOString()
      }

      await supabase
        .from('app_settings')
        .upsert({
          key: `shop_settings:${branchSlug}`,
          value: settingsPayload
        })

      // 2. Best-effort update to branches table
      await supabase
        .from('branches')
        .update({
          name: form.name,
          address: form.address
        })
        .eq('slug', branchSlug)

      if (form.browser_title) {
        document.title = form.browser_title
      }

      // Notify layout of update
      window.dispatchEvent(new CustomEvent('foami:shop-settings-updated', { detail: settingsPayload }))

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
        กำลังโหลดการตั้งค่า...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 780 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={24} color="var(--brand)" /> ตั้งค่าร้านค้าและแบรนด์ ({branchSlug})
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          ปรับแต่งชื่อแบรนด์ที่จะแสดงบนเบราว์เซอร์ โลโก้ และสีประจำสาขา
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Section 1: Display Name & Tab Title */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '24px 26px', boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={16} color="var(--brand)" /> ชื่อและข้อความแสดงผล (Browser Tab)
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
          </div>
        </div>

        {/* Section 2: Logo & Media (With ImageUpload Component) */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '24px 26px', boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImageIcon size={16} color="var(--brand)" /> โลโก้ร้านค้า
          </div>

          <ImageUpload
            value={form.logo_url}
            onChange={url => setForm(f => ({ ...f, logo_url: url }))}
            bucket="shop-assets"
            folder="logos"
            label="อัปโหลดรูปภาพโลโก้ร้าน"
          />
        </div>

        {/* Section 3: Theme Colors */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '24px 26px', boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Palette size={16} color="var(--brand)" /> ธีมสีประจำสาขา
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
            <MapPin size={16} color="var(--brand)" /> เบอร์โทรและที่อยู่สาขา
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                เบอร์โทรติดต่อ
              </label>
              <input
                type="text"
                placeholder="08X-XXX-XXXX"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 14,
                  border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'Kanit, sans-serif',
                  outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box'
                }}
              />
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

        {error && (
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderRadius: 12, background: '#FEE2E2', color: '#B91C1C', fontSize: 13 }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {savedSuccess && (
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderRadius: 12, background: '#DCFCE7', color: '#15803D', fontSize: 13, fontWeight: 600 }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> บันทึกข้อมูลตั้งค่าร้านเรียบร้อยแล้ว
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 24px', borderRadius: 16, background: 'var(--brand)', color: '#fff',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700,
            fontFamily: 'Kanit, sans-serif', boxShadow: 'var(--shadow-brand)', opacity: saving ? .7 : 1
          }}
        >
          <Save size={18} /> {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </form>
    </div>
  )
}
