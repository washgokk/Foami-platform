import type { Metadata, Viewport } from 'next'
import '../globals.css'
import LiffWrapper from './LiffWrapper'

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
}

export const metadata: Metadata = {
    title: 'Foami Wash & Delivery',
    description: 'บริการล้างและดูแลรถมอเตอร์ไซค์ถึงมือคุณ',
}

export default function LiffLayout({ children }: { children: React.ReactNode }) {
    return (
        <LiffWrapper>
            {children}
        </LiffWrapper>
    )
}
