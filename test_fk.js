require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('orders').insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    stripe_payment_intent_id: "test_fk",
    amount_usd: 1,
    status: "pending"
  });
  console.log("Error:", error);
}

run();
