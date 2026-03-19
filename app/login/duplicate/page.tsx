'use client'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Branding/Logo'
import styles from '../login.module.css'

export default function DuplicateSession() {
    const router = useRouter()

    return (
        <div className={styles.page}>
            <div className={styles.bgGlow}>
                <div className={styles.glow1} />
                <div className={styles.glow2} />
            </div>

            <div className={styles.content}>
                <div className={styles.logoBox}>
                    <Logo width={180} />
                </div>

                <div className={styles.welcomeSection}>
                    <h1 className={styles.headline}>กำลังใช้งานในอีกหน้าต่างหนึ่ง</h1>
                    <p className={styles.subheadline}>
                        ดูเหมือนว่าคุณได้เข้าสู่ระบบเรียบร้อยแล้วในอีกหน้าต่างหนึ่ง<br />
                        เพื่อป้องกันความสับสน เราได้ย้ายเซสชันไปที่นั่นครับ
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '320px', margin: '0 auto' }}>
                    <button 
                        className={styles.lineBtn}
                        onClick={() => router.push('/search')}
                        style={{ background: 'var(--primary)', border: 'none' }}
                    >
                        <span>กลับไปหน้าหลัก</span>
                    </button>
                    
                    <button 
                        className={styles.retryBtn}
                        onClick={() => {
                            localStorage.removeItem('liff_login_success');
                            localStorage.removeItem('liff_active_tab_id');
                            window.location.href = '/login';
                        }}
                    >
                        เข้าสู่ระบบใหม่ที่นี่
                    </button>
                </div>

                <p className={styles.footerHint} style={{ marginTop: '40px' }}>
                    คุณสามารถปิดหน้าต่างนี้ได้ทันทีครับ
                </p>
            </div>
        </div>
    )
}
