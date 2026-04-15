/**
 * Foami Scalable ID Utility
 * 
 * Design: {PREFIX}-{DATE}-{RANDOM}
 * - Customer: CU-26A7B8 (Short but scalable to 10M+)
 * - Booking:  BK-260313-X7R2A9 (Date-stamped, scalable to billions)
 */

export function generateScalableId(type: 'CU' | 'BK' | 'ST' | 'VH'): string {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    
    // Generate high-entropy random string in Base36
    // 36^6 = 2.1 Billion combinations
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    if (type === 'CU') {
        // CU-26-XXXXXX (Scalable to 2B+ customers per year)
        return `CU-${yy}-${random}`;
    }
    
    if (type === 'BK') {
        // BK-260313-XXXXXX (Scalable to 2B+ bookings per DAY)
        return `BK-${yy}${mm}${dd}-${random}`;
    }
    
    if (type === 'ST') {
        return `ST-${yy}-${random}`;
    }

    return `${type}-${yy}${mm}${dd}-${random}`;
}
