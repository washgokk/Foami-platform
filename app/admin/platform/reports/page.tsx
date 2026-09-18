import { redirect } from 'next/navigation'
export type { IncidentReport } from '@/app/platform/admin/reports/page'

export default function LegacyReportsRedirect() {
    redirect('/platform/admin/reports')
}
