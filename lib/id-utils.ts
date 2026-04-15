/**
 * Foami Scalable ID Utility
 * 
 * Design: {PREFIX}-{DATE}-{RANDOM}
 * - Customer: CU-26A7B8 (Short but scalable to 10M+)
 * - Booking:  BK-260313-X7R2A9 (Date-stamped, scalable to billions)
 */

export function generateScalableId(type?: 'CU' | 'BK' | 'ST' | 'VH'): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
