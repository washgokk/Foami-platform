const fs = require('fs');

const dbFile = 'mock_db.json';

// Initialize DB
function initDB() {
    fs.writeFileSync(dbFile, JSON.stringify({ services: [], addons: [] }, null, 2));
}

// SIMULATE: `saveAddon` from app/admin/services/page.tsx
function saveAddon(addonForm) {
    let descInfo = '';
    let finalPrice = 0;

    // 1. Encode into string
    if (addonForm.priceType === 'free') {
        descInfo = '\n[Pricing: Free]';
    } else if (addonForm.priceType === 'by_size') {
        const validPrices = addonForm.dynamicPrices.filter(p => p.label.trim() !== '');
        const priceStrings = validPrices.map(p => `${p.label}=${p.price}`);
        descInfo = `\n[Prices: ${priceStrings.join(', ')}]`;
        finalPrice = validPrices.length > 0 ? +validPrices[0].price : 0;
    } else {
        finalPrice = +addonForm.price;
    }

    // 2. Fetch DB and Save
    const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const newAddon = {
        id: Date.now().toString(),
        name: addonForm.name,
        description: addonForm.description + descInfo,
        price: finalPrice
    };
    db.addons.push(newAddon);
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));

    return newAddon;
}

// SIMULATE: `openAddonModal` from app/admin/services/page.tsx
function fetchAndParseAddon(id) {
    const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const a = db.addons.find(x => x.id === id);
    if (!a) return null;

    console.log('\n--- 📥 ดึงข้อมูลจากฐานข้อมูล (File DB) ---');
    console.log(a);

    // 3. Decode string
    const desc = a.description.split('\n[')[0] || a.description;
    const isFree = a.description.includes('[Pricing: Free]');
    const isBySize = a.description.includes('[Prices:');
    let dynPrices = [{ label: '', price: '0' }];

    if (isBySize) {
        const match = a.description.match(/\[Prices:\s*(.+?)\]/);
        if (match && match[1]) {
            dynPrices = match[1].split(',').map(part => {
                const [label, price] = part.split('=').map(s => s.trim());
                return { label, price: price || '0' };
            });
        }
    }

    // Fallback for old parsing
    if (isBySize && dynPrices.length === 1 && dynPrices[0].label === '') {
        const matchSmall = a.description.match(/เล็ก (\d+)/);
        const matchLarge = a.description.match(/ใหญ่ (\d+)/);
        dynPrices = [];
        if (matchSmall) dynPrices.push({ label: 'เล็ก', price: matchSmall[1] });
        if (matchLarge) dynPrices.push({ label: 'ใหญ่', price: matchLarge[1] });
        if (dynPrices.length === 0) dynPrices.push({ label: '', price: '0' });
    }

    const parsedForm = {
        name: a.name,
        description: desc,
        priceType: isFree ? 'free' : isBySize ? 'by_size' : 'fixed',
        price: String(a.price),
        dynamicPrices: dynPrices
    };

    console.log('--- 📤 แปลงข้อมูลกลับมาแสดงในหน้าเว็บ (Form State) ---');
    console.log(parsedForm);
    return parsedForm;
}

// RUN TEST
console.log('🚀 เริ่มการทดสอบฐานข้อมูลจำลอง (Mock DB)');
initDB();

console.log('\n📌 ทดสอบรูปแบบที่ 1: ราคาตามขนาด/เกรด (หลายราคา)');
const savedBySize = saveAddon({
    name: 'เปลี่ยนน้ำมันเครื่อง',
    description: 'ใช้ของเหลวคุณภาพดี',
    priceType: 'by_size',
    price: '0',
    dynamicPrices: [
        { label: 'ทั่วไป', price: '150' },
        { label: 'อย่างดี', price: '200' },
        { label: 'พรีเมียม', price: '350' }
    ]
});
fetchAndParseAddon(savedBySize.id);

console.log('\n================================');
console.log('📌 ทดสอบรูปแบบที่ 2: ฟรี (ไม่มีค่าใช้จ่าย)');
const savedFree = saveAddon({
    name: 'เติมลม',
    description: 'เช็คลมยางพร้อมเติมลมฟรี',
    priceType: 'free',
    price: '0',
    dynamicPrices: [{ label: '', price: '0' }]
});
fetchAndParseAddon(savedFree.id);

console.log('\n================================');
console.log('📌 ทดสอบรูปแบบที่ 3: ราคาคงที่');
const savedFixed = saveAddon({
    name: 'สลับยาง',
    description: 'ถอดล้อสลับยางหน้าหลัง',
    priceType: 'fixed',
    price: '120',
    dynamicPrices: [{ label: '', price: '0' }]
});
fetchAndParseAddon(savedFixed.id);

console.log('\n✅ การทดสอบเสร็จสมบูรณ์\nดูไฟล์ mock_db.json ได้ที่โฟลเดอร์ปัจจุบัน');
