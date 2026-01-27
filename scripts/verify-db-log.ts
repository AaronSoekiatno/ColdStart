
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyLogs() {
  console.log('🔍 Checking prompt_logs for recent entries...');
  const { data, error } = await supabase
    .from('prompt_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
      console.log('Last Log:', {
          id: data[0].id,
          tool: data[0].tool_name,
          prompt: data[0].prompt_text.substring(0, 20) + '...',
          created_at: data[0].created_at
      });
  }
}

verifyLogs();
