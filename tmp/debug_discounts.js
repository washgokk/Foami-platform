const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gkqlpowvcgqufemjwhzl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrcWxwb3d2Y2dxdWZlbWp3aHpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ5MjUzNiwiZXhwIjoyMDg5MDY4NTM2fQ.RdCEFZXu87l0GpU-txsGv0FvHZR8cuUaQ9ynBV0CIXo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('--- Checking discount_codes table ---');
  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error selecting from discount_codes:', JSON.stringify(error, null, 2));
  } else {
    console.log('Successfully selected from discount_codes. Data:', data);
  }

  console.log('\n--- Checking discount_usage table ---');
  const { data: usageData, error: usageError } = await supabase
    .from('discount_usage')
    .select('*')
    .limit(1);

  if (usageError) {
    console.error('Error selecting from discount_usage:', JSON.stringify(usageError, null, 2));
  } else {
    console.log('Successfully selected from discount_usage. Data:', usageData);
  }
}

debug();
