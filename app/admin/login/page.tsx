import { redirect } from 'next/navigation'

// A3 FIX: /admin/login redirects to platform admin login
// Shop admins should use /{branchSlug}/admin/login instead
export default function AdminLoginRedirect() {
    redirect('/admin/platform/login')
}