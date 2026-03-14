'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './profile-reward.module.css'

export default function ProfileRewardPage() {
    const [config, setConfig] = useState<any>({
        is_active: true,
        title: '',
        description: '',
        reward_code: '',
        button_text: 'ไปที่ตั้งค่า'
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        fetchConfig()
    }, [])

    const fetchConfig = async () => {
        setLoading(true)
        const { data } = await supabase.from('app_settings').select('*').eq('key', 'profile_reward').single()
        if (data) {
            setConfig(data.value)
        }
        setLoading(false)
    }

    const handleSave = async () => {
        setSaving(true)
        const { error } = await supabase.from('app_settings').upsert({
            key: 'profile_reward',
            value: config,
            updated_at: new Date().toISOString()
        })
        if (!error) {
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        }
        setSaving(false)
    }

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลด...</div>

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>🎁 ตั้งค่ากิจกรรมโปรไฟล์</h1>
                    <p className={styles.subtitle}>จัดการของรางวัลและข้อความเชิญชวนให้ลูกค้ากรอกข้อมูล Demographic</p>
                </div>
                <button className={`btn btn-primary ${styles.saveBtn}`} onClick={handleSave} disabled={saving}>
                    {saving ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
                </button>
            </div>

            {saved && (
                <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 20px', borderRadius: 12, marginBottom: 24, fontWeight: 600 }}>
                    ✅ บันทึกการตั้งค่าเรียบร้อยแล้ว
                </div>
            )}

            <div className={styles.card}>
                <div className={styles.section}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>สถานะกิจกรรม</h2>
                        <label className={styles.switch}>
                            <input 
                                type="checkbox" 
                                checked={config.is_active} 
                                onChange={e => setConfig({ ...config, is_active: e.target.checked })} 
                            />
                            <span className={styles.slider}></span>
                        </label>
                    </div>
                </div>

                <div className={styles.grid}>
                    <div className="form-group">
                        <label className="form-label">หัวข้อ (Title)</label>
                        <input 
                            className="form-input" 
                            value={config.title} 
                            onChange={e => setConfig({ ...config, title: e.target.value })} 
                            placeholder="เช่น 🎁 ของขวัญพิเศษสำหรับคุณ!"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">ชื่อโค้ดส่วนลด (Reward Code)</label>
                        <input 
                            className="form-input" 
                            style={{ fontWeight: 800, color: 'var(--primary)', letterSpacing: 1 }}
                            value={config.reward_code} 
                            onChange={e => setConfig({ ...config, reward_code: e.target.value })} 
                            placeholder="เช่น PROCOMP10"
                        />
                        <small style={{ color: 'var(--text-muted)' }}>*ตรวจสอบให้แน่ใจว่าโค้ดนี้มีอยู่ในระบบโค้ดส่วนลดแล้ว</small>
                    </div>
                </div>

                <div className="form-group" style={{ marginTop: 20 }}>
                    <label className="form-label">คำอธิบาย (Description)</label>
                    <textarea 
                        className="form-input" 
                        rows={3}
                        value={config.description} 
                        onChange={e => setConfig({ ...config, description: e.target.value })} 
                        placeholder="เช่น เพียงกรอกข้อมูลโปรไฟล์ให้ครบถ้วน รับทันทีส่วนลดสำหรับการล้างรถครั้งถัดไป"
                    />
                </div>

                <div className="form-group" style={{ marginTop: 20 }}>
                    <label className="form-label">ข้อความบนปุ่ม (Button Text)</label>
                    <input 
                        className="form-input" 
                        value={config.button_text} 
                        onChange={e => setConfig({ ...config, button_text: e.target.value })} 
                        placeholder="เช่น ไปที่ตั้งค่า"
                    />
                </div>
            </div>

            <div className={styles.preview}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>ตัวอย่างการแสดงผลบนแอปลูกค้า (Preview)</h3>
                <div style={{ background: 'linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%)', padding: 20, borderRadius: 16, border: '1px solid #FDBA74', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '4rem', opacity: 0.1 }}>🎁</div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ fontWeight: 800, color: '#9A3412', fontSize: '1rem', marginBottom: 4 }}>{config.title || 'หัวข้อกิจกรรม'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#C2410C', marginBottom: 12, lineHeight: 1.4 }}>{config.description || 'คำอธิบายกิจกรรม'}</div>
                        <button className="btn btn-sm" style={{ background: '#9A3412', color: '#fff', border: 'none', borderRadius: 99, padding: '6px 16px' }}>
                            {config.button_text || 'ปุ่มกด'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
