
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('bookings').select('id, status, payment_status, payout_id, staff_id').neq('status', 'completed').eq('payment_status', 'paid');
    if (error) {
        console.error(error);
        return;
    }
    console.log('--- Paid but Incomplete ---');
    console.table(data);
}

check();
