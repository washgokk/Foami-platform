const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
    console.log('Reading migration file...')
    const migrationSql = fs.readFileSync(path.join(__dirname, 'supabase', 'fix_multi_device_push.sql'), 'utf8')
    
    console.log('Executing migration...')
    const { error } = await supabase.rpc('exec_sql', { sql_query: migrationSql })
    
    if (error) {
        if (error.message.includes('function "exec_sql" does not exist')) {
            console.error('ERROR: Database helper function "exec_sql" not found.')
            console.log('Please run the SQL manually in the Supabase Dashboard SQL Editor:')
            console.log('--------------------------------------------------')
            console.log(migrationSql)
            console.log('--------------------------------------------------')
        } else {
            console.error('Migration failed:', error)
        }
    } else {
        console.log('Migration successful!')
    }
}

runMigration()
