
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('bookings').select('id, status, payment_status, payout_id, staff_id').limit(20);
    if (error) {
        console.error(error);
        return;
    }
    console.log('--- Bookings (Last 20) ---');
    console.table(data);
    
    const { count: completedCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed').is('payout_id', null);
    console.log('Completed & Unpaid (Payout):', completedCount);
}

check();
