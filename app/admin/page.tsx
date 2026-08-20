import { redirect } from 'next/navigation'

// D2 FIX: /admin root redirects to platform admin
// (old B2C /admin/dashboard no longer primary entry point)
export default function AdminIndex() {
    redirect('/admin/platform')
}