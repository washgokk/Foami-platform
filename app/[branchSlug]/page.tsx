'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * BranchEntry Page (v40)
 * Silent redirector that handles:
 * 1. Visit tracking (DB persistence)
 * 2. Unification (Redirects to /login if not authenticated)
 */
export default function LiffEntry() {
    const { branchSlug } = useParams<{ branchSlug: string }>()
    const router = useRouter()

    useEffect(() => {
        if (!branchSlug) return;

        const stored = localStorage.getItem('liff_customer');
        
        if (stored) {
            try {
                const customer = JSON.parse(stored);
                if (customer.line_user_id) {
                    // v39: Real-time Visit Tracking (Persistent Intent)
                    // We update the DB immediately to remember this branch across all devices.
                    supabase
                        .from('customers')
                        .update({ last_branch_slug: branchSlug })
                        .eq('line_user_id', customer.line_user_id)
                        .then(({ error }) => {
                            if (!error) {
                                // Sync local memory
                                customer.last_branch_slug = branchSlug;
                                localStorage.setItem('liff_customer', JSON.stringify(customer));
                                localStorage.setItem('last_branch_slug', branchSlug);
                            }
                            // Silent redirect to the menu
                            router.replace(`/${branchSlug}/menu`);
                        });
                    return;
                }
            } catch (e) { }
        }

        // v40: Zero-UI Unification
        // If not logged in, we immediately route to the premium global /login.
        // We pass the branch as a hint so /login knows where to send them back.
        localStorage.setItem('last_branch_slug', branchSlug);
        router.replace(`/login?branch=${branchSlug}`);
        
    }, [branchSlug, router]);

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-blue) 100%)',
            padding: 'var(--space-6)'
        }}>
            {/* Minimal Spinner for transition */}
            <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: 32, height: 32 }} />
        </div>
    )
}
