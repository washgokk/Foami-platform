const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkAdmins() {
  console.log('Checking for Admin accounts in Supabase...\n');

  // 1. Get all staff with admin role
  const { data: staff, error: staffErr } = await supabase
    .from('staff')
    .select('id, full_name, email, role, is_active')
    .eq('role', 'admin');

  if (staffErr) {
    console.error('Error fetching staff:', staffErr.message);
    return;
  }

  if (!staff || staff.length === 0) {
    console.log('⚠️ No staff members found with "admin" role in the "staff" table.');
  } else {
    console.log(`Found ${staff.length} admin(s) in "staff" table:`);
    staff.forEach(s => {
      console.log(`- ${s.full_name} (${s.email}) [ID: ${s.id}] [Active: ${s.is_active}]`);
    });
  }

  // 2. Get all Auth users
  console.log('\nChecking Supabase Auth users...');
  const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();

  if (authErr) {
    console.error('Error fetching auth users:', authErr.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log('⚠️ No users found in Supabase Auth.');
  } else {
    console.log(`Found ${users.length} user(s) in Auth.`);
    
    // Check if staff emails match auth emails
    staff?.forEach(s => {
      const authUser = users.find(u => u.email === s.email);
      if (authUser) {
        console.log(`✅ ${s.email}: Found in both Auth and Staff table.`);
        if (authUser.id !== s.id) {
          console.log(`   ❌ WARNING: ID mismatch! Auth ID: ${authUser.id} vs Staff Table ID: ${s.id}`);
        }
      } else {
        console.log(`❌ ${s.email}: Found in Staff table but MISSING in Supabase Auth!`);
      }
    });

    // Check for Auth users not in staff table
    users.forEach(u => {
      const staffMember = staff?.find(s => s.email === u.email);
      if (!staffMember) {
        console.log(`ℹ️ ${u.email}: Found in Auth but is NOT an admin in Staff table.`);
      }
    });
  }
}

checkAdmins();
