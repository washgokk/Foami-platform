'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LiffEntry() {
    const { branchSlug } = useParams<{ branchSlug: string }>()
    const router = useRouter()

    // v39: Real-time Visit Tracking & Smart Redirect
    useEffect(() => {
        const stored = localStorage.getItem('liff_customer');
        if (stored && branchSlug) {
            try {
                const customer = JSON.parse(stored);
                if (customer.line_user_id) {
                    // 1. Update DB immediately (Persistent Intent)
                    supabase
                        .from('customers')
                        .update({ last_branch_slug: branchSlug })
                        .eq('line_user_id', customer.line_user_id)
                        .then(({ error }) => {
                            if (!error) {
                                customer.last_branch_slug = branchSlug;
                                localStorage.setItem('liff_customer', JSON.stringify(customer));
                                localStorage.setItem('last_branch_slug', branchSlug);
                                // 2. Proceed to menu
                                router.replace(`/${branchSlug}/menu`);
                            } else {
                                // Even if DB fails, proceed locally
                                router.replace(`/${branchSlug}/menu`);
                            }
                        });
                    return;
                }
            } catch (e) { }
        }

        // If not logged in, we check if we just came back from a login attempt
        const hasSuccess = localStorage.getItem('liff_login_success');
        
        if (hasSuccess) {
            localStorage.removeItem('liff_login_success');
            router.replace(`/${branchSlug}/menu`);
            return;
        }

        // Watchdog for cross-tab login success
        const watchdog = setInterval(() => {
            if (localStorage.getItem('liff_login_success') || localStorage.getItem('liff_customer')) {
                localStorage.removeItem('liff_login_success');
                router.replace(`/${branchSlug}/menu`);
            }
        }, 1000);

        return () => clearInterval(watchdog);
    }, [branchSlug, router]);

    const handleLineLogin = () => {
        // v39: Unify Login - Always use the premium /login page
        localStorage.setItem('last_branch_slug', branchSlug);
        window.location.href = `/login?branch=${branchSlug}`;
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-blue) 100%)',
            gap: '24px',
            padding: 'var(--space-6)'
        }}>
            <img
                src="/logo - lanscape.svg"
                alt="Foami Logo"
                style={{ width: '100%', maxWidth: '240px', height: 'auto', filter: 'brightness(0) invert(1)' }}
            />
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '300px' }}>
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem', fontWeight: 500, textAlign: 'center' }}>
                    ยินดีต้อนรับสู่ Foami สาขา {branchSlug?.toUpperCase()}
                </p>

                <button
                    onClick={handleLineLogin}
                    style={{
                        width: '100%',
                        background: '#06C755',
                        color: '#fff',
                        border: 'none',
                        padding: '14px 24px',
                        borderRadius: '30px',
                        fontWeight: 600,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                    }}
                >
                    <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" style={{ width: 22 }} />
                    เข้าสู่ระบบด้วย LINE
                </button>

                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textAlign: 'center', marginTop: '10px' }}>
                    จองคิวล้างรถพรีเมียมได้ง่ายๆ ในไม่กี่ขั้นตอน
                </p>
            </div>
        </div>
    )
}
