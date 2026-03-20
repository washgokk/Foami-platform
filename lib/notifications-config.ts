/**
 * FOAMI Notification Configuration
 * Centralized source of truth for all customer and staff notifications.
 * Edit this file to change any notification message in the system.
 */

export const NOTIFICATIONS = {
    CUSTOMER: {
        ACCEPTED: {
            pushTitle: 'พนักงานรับงานแล้ว! ✅',
            pushBody: (date: string, time: string) => `พนักงานกำลังเตรียมตัวเพื่อไปดูแลรถของคุณในวันที่ ${date} เวลา ${time} เตรียมตัวรอรับบริการได้เลยครับ`,
            lineMessage: (date: string, time: string) => `✅ พนักงานรับงานของคุณแล้ว!\nวันที่: ${date}\nเวลา: ${time}\nเตรียมตัวรอรับบริการได้เลยครับ`
        },
        CONFIRMED: {
            pushTitle: 'ยืนยันนัดหมาย! 🤝',
            pushBody: 'เรายืนยันนัดหมายของคุณแล้ว พนักงานจะเดินทางไปตามเวลาที่กำหนด',
            lineMessage: 'ยืนยันแล้ว! เรากำลังเดินทางไปหาคุณในไม่ช้า'
        },
        PICKING_UP: {
            pushTitle: 'พนักงานกำลังเดินทาง! 🏍️',
            pushBody: 'พนักงานกำลังมารับรถของคุณแล้ว เตรียมกุญแจไว้ได้เลยครับ',
            lineMessage: '🏍️ พนักงานกำลังมารับรถของคุณแล้ว!\nเตรียมกุญแจไว้ได้เลยครับ'
        },
        WASHING: {
            pushTitle: 'เริ่มล้างรถแล้ว 🫧',
            pushBody: 'กำลังล้างรถของคุณอย่างพิถีพิถัน เดี๋ยวเสร็จแล้วครับ!',
            lineMessage: '🫧 รถของคุณกำลังถูกล้างอยู่\nอย่างละพิถีพิถัน เดี๋ยวเสร็จแล้วครับ!'
        },
        DELIVERING: {
            pushTitle: 'ล้างเสร็จแล้ว! 🚗',
            pushBody: 'พนักงานกำลังนำรถกลับ เตรียมรอรับรถสุดเงาได้เลยครับ',
            lineMessage: '🚗 ล้างเสร็จแล้ว! พนักงานกำลังนำรถกลับ\nเตรียมรอรับรถสุดเงาได้เลยครับ'
        },
        PAYMENT_PENDING: {
            pushTitle: 'รอการชำระเงินค่าส่วนต่าง 💳',
            pushBody: (amount: number) => `มีค่าใช้จ่ายเพิ่มเติม ฿${amount.toLocaleString()} รบกวนตรวจสอบและชำระเพื่อดำเนินการต่อครับ`,
            lineMessage: (amount: number, note?: string) => `💰 มีค่าใช้จ่ายเพิ่มเติมครับ\nยอดเงิน: ฿${amount.toLocaleString()}${note ? `\nรายละเอียด: ${note}` : ''}\n\nรบกวนตรวจสอบและชำระเพื่อดำเนินการต่อครับ`
        },
        COMPLETED: {
            pushTitle: 'ดูแลรถเรียบร้อยแล้ว! 🎉',
            pushBody: 'ขอบคุณที่ใช้บริการ Foami อย่าลืมให้คะแนนเราด้วยนะครับ',
            lineMessage: '🎉 ส่งรถเรียบร้อยแล้ว! ขอบคุณที่ใช้บริการ Foami\nอย่าลืมให้คะแนนความพึงพอใจกับเราด้วยนะครับ'
        },
        AUTO_ASSIGNED: {
            pushTitle: 'ยืนยันพนักงานรับงาน! ✅',
            pushBody: (date: string, time: string) => `พนักงานรับงานแล้ว! จะเข้าดูแลรถของคุณในวันที่ ${date} เวลา ${time}`,
            lineMessage: (date: string, time: string) => `✅ พนักงานรับงานของคุณแล้ว!\nวันที่: ${date}\nเวลา: ${time}\nเตรียมตัวรอรับบริการได้เลยครับ`
        }
    },
    STAFF: {
        NEW_JOB: {
            pushTitle: '🔔 มีงานใหม่เข้า!',
            pushBody: (date: string, time: string) => `วันที่: ${date} เวลา: ${time}\nกดเพื่อดูรายละเอียดและรับงานเลย`,
            lineMessage: (date: string, time: string) => `🔔 มีงานใหม่!\nวันที่: ${date} เวลา: ${time}\nกรุณาเปิดแอปเพื่อรับงาน`
        },
        REMINDER: {
            pushTitle: '📢 ยังไม่มีคนรับงาน!',
            pushBody: (date: string, time: string) => `งานวันที่ ${date} เวลา ${time} รอคุณอยู่\nกดรับงานเพื่อเริ่มหารายได้เลย!`,
            lineMessage: (date: string, time: string) => `📢 แจ้งเตือนย้ำ!\nยังไม่มีคนรับงานวันที่ ${date} เวลา ${time}\nรีบกดรับงานก่อนโดนแย่งนะครับ!`
        },
        AUTO_ASSIGNED: {
            pushTitle: '🚨 งานถูกมอบหมายอัตโนมัติ!',
            pushBody: (date: string, time: string) => `ได้รับงานวันที่: ${date} เวลา: ${time}`,
            lineMessage: (date: string, time: string) => `คุณได้รับมอบหมายงานใหม่\nวันที่: ${date}\nเวลา: ${time}`
        },
        CANCELLED: {
            pushTitle: 'งานถูกยกเลิก! ❌',
            pushBody: (id: string, date: string, time: string) => `งาน #${id.slice(0, 8)} วันที่ ${date} เวลา ${time} ถูกยกเลิกโดยลูกค้า`,
            lineMessage: (id: string, date: string, time: string) => `❌ งาน #${id.slice(0, 8)} วันที่ ${date} เวลา ${time} ถูกยกเลิกโดยลูกค้า\nคุณสามารถรับงานอื่นต่อได้ทันที`
        },
        RESCHEDULED: {
            pushTitle: 'ลูกค้าเลื่อนนัด! 📅',
            pushBody: (id: string, date: string, time: string) => `คิวงาน #${id.slice(0, 8)} เลื่อนเป็น ${date} @ ${time}`,
            lineMessage: (id: string, date: string, time: string) => `📅 ลูกค้าเลื่อนนัด!\nคิวงาน #${id.slice(0, 8)} เลื่อนเป็น ${date} @ ${time}\nตรวจสอบตารางงานอีกครั้งนะครับ`
        },
        PAID_EXTRA: {
            pushTitle: 'ลูกค้าชำระเงินแล้ว! ✨',
            pushBody: (id: string, amount: number) => `ยอดเพิ่มเติม ฿${amount.toLocaleString()} (งาน #${id.slice(0, 8)}) ชำระเรียบร้อย`,
            lineMessage: (id: string, amount: number) => `💰 ลูกค้าชำระเงินเพิ่มแล้ว!\nยอดเงิน ฿${amount.toLocaleString()} (งาน #${id.slice(0, 8)}) ชำระเรียบร้อย\nคุณสามารถดำเนินการต่อได้เลยครับ`
        }
    }
}
