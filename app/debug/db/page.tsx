'use client'
import { useEffect, useState } from 'react'

export default function DebugDbPage() {
    const [db, setDb] = useState<any>({})

    useEffect(() => {
        const data: any = {}
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key?.startsWith('foami_mock_db_')) {
                try {
                    data[key] = JSON.parse(localStorage.getItem(key) || '[]')
                } catch (e) {
                    data[key] = localStorage.getItem(key)
                }
            }
        }
        setDb(data)
    }, [])

    return (
        <div style={{ padding: 20 }}>
            <h1>Mock DB Debugger</h1>
            <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 8, overflow: 'auto', maxHeight: '80vh' }}>
                {JSON.stringify(db, null, 2)}
            </pre>
        </div>
    )
}
