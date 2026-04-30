const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log("--- Tables in Public Schema ---");
    const { data: tables, error: tableError } = await supabase
        .from('pg_catalog.pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');
    
    if (tableError) {
        // Alternative way if pg_tables is restricted
        console.log("Could not list tables via pg_tables. Trying common table names...");
    } else {
        console.log("Tables:", tables.map(t => t.tablename).join(', '));
    }

    const targetTables = ['orders', 'pending_claims', 'purchases', 'transactions', 'wallets', 'users'];
    
    for (const table of targetTables) {
        console.log(`\n--- Table: ${table} (Top 3) ---`);
        const { data, error } = await supabase.from(table).select('*').limit(3).order('created_at', { ascending: false });
        if (error) {
            console.log(`Error reading ${table}: ${error.message}`);
        } else {
            console.log(JSON.stringify(data, null, 2));
        }
    }
}

inspect();
