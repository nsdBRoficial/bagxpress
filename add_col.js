const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS phantom_wallet TEXT;'
  });
  console.log("RPC Error:", error);
  console.log("RPC Data:", data);
}

run();
