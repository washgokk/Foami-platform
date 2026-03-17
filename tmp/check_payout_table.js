
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('staff_payouts').select('*').limit(1);
    if (error) {
        console.log('Error or Table Missing:', error.message);
    } else {
        console.log('staff_payouts table exists.');
    }
}

check();
